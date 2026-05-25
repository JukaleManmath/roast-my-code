import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


class ReviewConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for live review streaming.

    One instance per browser connection.
    Joins the channel group for the review, replays past events,
    then forwards any new events from Celery to the browser.
    """

    async def connect(self) -> None:
        self.review_id  = self.scope['url_route']['kwargs']['review_id']
        self.group_name = f'review_{self.review_id}'

        # Join the channel group — this consumer will receive all group_send messages
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info('WebSocket connected: review=%s', self.review_id)

        # Replay past events for late-connecting clients (page refresh, slow load)
        await self._replay_event_log()

    async def disconnect(self, close_code: int) -> None:
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        logger.info('WebSocket disconnected: review=%s code=%s', self.review_id, close_code)

    async def receive(self, text_data: str = None, bytes_data: bytes = None) -> None:
        # Clients don't send messages in this app — only the server pushes events
        pass

    async def review_event(self, event: dict) -> None:
        """
        Called by Django Channels when the group receives a group_send message.
        'type': 'review.event' in group_send maps to this method name (dots → underscores).
        Forwards the event to the connected browser as JSON.
        """
        # Remove the internal 'type' key — browser doesn't need it
        payload = {k: v for k, v in event.items() if k != 'type'}
        await self.send(text_data=json.dumps(payload))

    async def _replay_event_log(self) -> None:
        """
        Fetch Review.event_log from DB and send all past events to the browser.
        Handles clients that connect after some or all agents have finished.
        """
        from apps.reviews.models import Review

        try:
            review = await sync_to_async(Review.objects.get)(id=self.review_id)
        except Review.DoesNotExist:
            await self.send(text_data=json.dumps({
                'event': 'error',
                'message': 'Review not found.',
            }))
            await self.close()
            return

        for past_event in review.event_log:
            await self.send(text_data=json.dumps(past_event))
