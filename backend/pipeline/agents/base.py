import json
import logging
from datetime import date
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db.models.expressions import RawSQL
from groq import Groq

logger = logging.getLogger(__name__)

# JSON schema every agent must return
AGENT_RESPONSE_SCHEMA = """
{
  "issues": [
    {
      "title": "string",
      "description": "string",
      "severity": "critical|warning|suggestion",
      "line_hint": "string"
    }
  ],
  "summary": "string",
  "overall_severity": "critical|warning|suggestion"
}
"""


def call_agent(
    agent_name: str,
    system_prompt: str,
    state: dict,
) -> dict:
    """
    Core agent runner. Called by every agent node.

    1. Calls Groq with the persona system prompt + code
    2. Parses JSON response
    3. Broadcasts agent_done event over WebSocket
    4. Returns {agent_name: verdict}
    """
    review_id = state['review_id']
    raw_code  = state['raw_code']
    language  = state['language']
    filename  = state['filename']

    client = Groq(api_key=settings.GROQ_API_KEY)

    user_content = (
        f"Language: {language}\n"
        f"Filename: {filename or 'unknown'}\n\n"
        f"```\n{raw_code}\n```"
    )

    tokens_used: dict | None = None

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_content},
            ],
            max_tokens=1200,
            temperature=0.3,
        )
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        verdict = _parse_verdict(agent_name, content)

        if finish_reason == 'length':
            logger.warning('Agent %s response truncated for review %s', agent_name, review_id)
            verdict['summary'] += ' [Note: response was truncated due to length]'

        if response.usage:
            tokens_in  = response.usage.prompt_tokens
            tokens_out = response.usage.completion_tokens
            tokens_used = {'in': tokens_in, 'out': tokens_out, 'total': tokens_in + tokens_out}
            _increment_daily_token_budget(tokens_in + tokens_out)
            logger.info('Agent %s tokens — in: %d, out: %d', agent_name, tokens_in, tokens_out)

    except Exception as exc:
        logger.error('Agent %s failed for review %s: %s', agent_name, review_id, exc)
        verdict = _error_verdict(str(exc))

    _broadcast_agent_done(review_id, agent_name, verdict, tokens_used)

    return {agent_name: verdict}


def check_daily_token_budget() -> tuple[bool, int]:
    """
    Return (budget_ok, tokens_used_today).
    budget_ok is False when usage exceeds DAILY_TOKEN_SOFT_LIMIT (default 85K).
    """
    from django.core.cache import cache

    soft_limit = getattr(settings, 'GROQ_DAILY_TOKEN_SOFT_LIMIT', 85_000)
    key = f'tokens:daily:{date.today().isoformat()}'
    used = int(cache.get(key) or 0)
    return used < soft_limit, used


def _increment_daily_token_budget(tokens: int) -> None:
    from django.core.cache import cache

    key = f'tokens:daily:{date.today().isoformat()}'
    try:
        cache.incr(key, tokens)
    except ValueError:
        # Key doesn't exist yet — set it with a 25-hour TTL so it auto-expires
        cache.set(key, tokens, timeout=90_000)


def _parse_verdict(agent_name: str, content: str) -> dict:
    """Extract JSON from LLM response. Handles markdown code fences."""
    # Strip markdown code fences if present
    text = content.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]) if lines[-1].strip() == '```' else '\n'.join(lines[1:])

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error('Agent %s returned invalid JSON: %s', agent_name, text[:200])
        return _error_verdict(f'Failed to parse {agent_name} response as JSON')


def _error_verdict(message: str) -> dict:
    return {
        'issues': [{
            'title': 'Agent Error',
            'description': message,
            'severity': 'warning',
            'line_hint': '',
        }],
        'summary': f'Agent encountered an error: {message}',
        'overall_severity': 'warning',
    }


def _broadcast_agent_done(
    review_id: str,
    agent_name: str,
    verdict: dict,
    tokens_used: dict | None = None,
) -> None:
    """Send agent_done event to the WebSocket group and persist to event_log."""
    from apps.reviews.models import Review

    payload: dict = {'event': 'agent_done', 'agent': agent_name, 'result': verdict}
    if tokens_used:
        payload['tokens_used'] = tokens_used

    # Persist to event_log for replay.
    # Use PostgreSQL's || operator so parallel agents don't overwrite each other.
    Review.objects.filter(id=review_id).update(
        event_log=RawSQL('event_log || %s::jsonb', [json.dumps([payload])])
    )

    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning('No channel layer configured — skipping WebSocket broadcast')
        return

    async_to_sync(channel_layer.group_send)(
        f'review_{review_id}',
        {'type': 'review.event', **payload},
    )
