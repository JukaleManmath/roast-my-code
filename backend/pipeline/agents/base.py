import json
import logging
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

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_content},
            ],
            max_tokens=4096,
            temperature=0.3,
        )
        content = response.choices[0].message.content
        finish_reason = response.choices[0].finish_reason
        verdict = _parse_verdict(agent_name, content)

        if finish_reason == 'length':
            logger.warning('Agent %s response truncated for review %s', agent_name, review_id)
            verdict['summary'] += ' [Note: response was truncated due to length]'

    except Exception as exc:
        logger.error('Agent %s failed for review %s: %s', agent_name, review_id, exc)
        verdict = _error_verdict(str(exc))

    _broadcast_agent_done(review_id, agent_name, verdict)

    return {agent_name: verdict}


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


def _broadcast_agent_done(review_id: str, agent_name: str, verdict: dict) -> None:
    """Send agent_done event to the WebSocket group and persist to event_log."""
    from apps.reviews.models import Review

    payload = {'event': 'agent_done', 'agent': agent_name, 'result': verdict}

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
