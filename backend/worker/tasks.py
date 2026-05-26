import json
import logging
from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.db.models.expressions import RawSQL
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def run_review_pipeline(self, review_id: str) -> None:
    """
    Celery task — runs the full LangGraph review pipeline for a given review.

    Lifecycle:
        PENDING → RUNNING → DONE
        PENDING → RUNNING → FAILED (on unrecoverable error)

    bind=True          → gives access to self (the task instance) for retries
    max_retries=2      → retry up to 2 times before marking as FAILED
    default_retry_delay→ wait 5 seconds between retries
    """
    # Import here to avoid circular imports at module level
    from apps.reviews.models import Review
    from pipeline.graph import review_graph

    try:
        review = Review.objects.get(id=review_id)
    except Review.DoesNotExist:
        logger.error('Review %s not found — task aborted', review_id)
        return

    try:
        # Mark as running
        review.status = Review.Status.RUNNING
        review.save(update_fields=['status'])

        _broadcast(review_id, {'type': 'review.event', 'event': 'pipeline_start'})

        # Build initial state
        initial_state = {
            'raw_code':   review.raw_code,
            'language':   review.language,
            'filename':   review.filename,
            'review_id':  str(review.id),
            'pragmatist': {},
            'paranoid':   {},
            'minimalist': {},
            'optimizer':  {},
            'mentor':     {},
            'synthesis':  {},
        }

        # Run the pipeline — blocks until all agents + synthesis complete
        final_state = review_graph.invoke(initial_state)

        # Persist results to database
        review.agent_results = {
            'pragmatist': final_state.get('pragmatist', {}),
            'paranoid':   final_state.get('paranoid',   {}),
            'minimalist': final_state.get('minimalist', {}),
            'optimizer':  final_state.get('optimizer',  {}),
            'mentor':     final_state.get('mentor',     {}),
        }
        review.synthesis     = final_state.get('synthesis', {})
        review.status        = Review.Status.DONE
        review.completed_at  = timezone.now()
        review.save(update_fields=[
            'agent_results', 'synthesis', 'status', 'completed_at'
        ])

        _broadcast(review_id, {'type': 'review.event', 'event': 'done'})
        logger.info('Review %s completed successfully', review_id)

    except Exception as exc:
        logger.error('Review %s failed: %s', review_id, exc, exc_info=True)

        # Only mark as FAILED on the final retry (correction #17)
        if self.request.retries >= self.max_retries:
            review.status        = Review.Status.FAILED
            review.error_message = str(exc)
            review.save(update_fields=['status', 'error_message'])

            _broadcast(review_id, {
                'type':    'review.event',
                'event':   'error',
                'message': 'Review pipeline failed. Please try again.',
            })
        else:
            raise self.retry(exc=exc)


def _broadcast(review_id: str, message: dict) -> None:
    """
    Send a message to the WebSocket group and persist it to event_log
    so late-connecting clients can replay past events.
    """
    from apps.reviews.models import Review

    # Persist to event_log — strip internal 'type' key before storing.
    # Use PostgreSQL's || operator for an atomic append (no read-modify-write).
    payload = {k: v for k, v in message.items() if k != 'type'}
    Review.objects.filter(id=review_id).update(
        event_log=RawSQL('event_log || %s::jsonb', [json.dumps([payload])])
    )

    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f'review_{review_id}',
        message,
    )


