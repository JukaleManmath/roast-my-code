import json
import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from pipeline.agents.base import build_llm, _broadcast_agent_done
from pipeline.state import ReviewState

logger = logging.getLogger(__name__)

AGENT_NAMES = ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor']

SYSTEM_PROMPT = """You are a Tech Lead facilitating a code review discussion between five engineers.
You have received their independent reviews and must synthesise them into a final verdict.

Your job:
1. Issues flagged by 2 or more agents → mark as Critical (high signal, consensus)
2. Issues flagged by only 1 agent → include as-is with which agent flagged it
3. Explicit contradictions between agents → surface as conflicts worth discussing
4. Calculate an overall roast score 0-100:
   - 0   = clean, production-ready code
   - 100 = complete rewrite candidate
   Weight: critical issues heavily, warnings moderately, suggestions lightly.

Return ONLY valid JSON matching this schema — no markdown, no explanation:
{
  "critical":    [{"title": "string", "description": "string", "agents": ["agent_name"]}],
  "warnings":    [{"title": "string", "description": "string", "agents": ["agent_name"]}],
  "suggestions": [{"title": "string", "description": "string", "agents": ["agent_name"]}],
  "conflicts":   [{"topic": "string", "positions": {"agent_name": "their position"}}],
  "overall_score": 0,
  "summary": "string"
}"""


def synthesis_node(state: ReviewState) -> dict:
    review_id = state['review_id']

    # Build a summary of all agent findings to feed into synthesis
    agent_summaries = {}
    for name in AGENT_NAMES:
        agent_summaries[name] = state.get(name, {})

    human_content = (
        f"Language: {state['language']}\n"
        f"Filename: {state['filename'] or 'unknown'}\n\n"
        f"Agent reviews:\n{json.dumps(agent_summaries, indent=2)}"
    )

    llm = build_llm()
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=human_content),
    ]

    try:
        response = llm.invoke(messages)
        verdict  = _parse_synthesis(response.content)
    except Exception as exc:
        logger.error('Synthesis failed for review %s: %s', review_id, exc)
        verdict = _error_synthesis(str(exc))

    _broadcast_synthesis_done(review_id, verdict)

    return {'synthesis': verdict}


def _parse_synthesis(content: str) -> dict:
    text = content.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]) if lines[-1].strip() == '```' else '\n'.join(lines[1:])
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error('Synthesis returned invalid JSON: %s', text[:200])
        return _error_synthesis('Failed to parse synthesis response as JSON')


def _error_synthesis(message: str) -> dict:
    return {
        'critical':    [],
        'warnings':    [{'title': 'Synthesis Error', 'description': message, 'agents': []}],
        'suggestions': [],
        'conflicts':   [],
        'overall_score': 0,
        'summary': f'Synthesis encountered an error: {message}',
    }


def _broadcast_synthesis_done(review_id: str, verdict: dict) -> None:
    from apps.reviews.models import Review

    payload = {'event': 'synthesis_done', 'verdict': verdict}

    # Persist to event_log for replay
    try:
        review = Review.objects.get(id=review_id)
        review.event_log = review.event_log + [payload]
        review.save(update_fields=['event_log'])
    except Review.DoesNotExist:
        pass

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f'review_{review_id}',
        {'type': 'review.event', **payload},
    )
