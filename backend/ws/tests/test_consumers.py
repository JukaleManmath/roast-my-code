import json
from unittest.mock import AsyncMock, MagicMock, patch

from unittest import IsolatedAsyncioTestCase

from ws.consumers import ReviewConsumer


class ReviewEventTests(IsolatedAsyncioTestCase):
    """Tests for ReviewConsumer.review_event() — the group_send forwarder."""

    async def test_type_key_is_stripped_from_outgoing_payload(self):
        consumer = ReviewConsumer()
        consumer.send = AsyncMock()

        await consumer.review_event({
            'type': 'review.event',
            'event': 'agent_done',
            'agent': 'pragmatist',
            'result': {'summary': 'ok'},
        })

        consumer.send.assert_called_once()
        text = consumer.send.call_args[1]['text_data']
        parsed = json.loads(text)
        self.assertNotIn('type', parsed)

    async def test_event_fields_are_forwarded(self):
        consumer = ReviewConsumer()
        consumer.send = AsyncMock()

        await consumer.review_event({
            'type': 'review.event',
            'event': 'synthesis_done',
            'verdict': {'overall_score': 42},
        })

        text = consumer.send.call_args[1]['text_data']
        parsed = json.loads(text)
        self.assertEqual(parsed['event'], 'synthesis_done')
        self.assertEqual(parsed['verdict']['overall_score'], 42)

    async def test_done_event_is_forwarded(self):
        consumer = ReviewConsumer()
        consumer.send = AsyncMock()

        await consumer.review_event({'type': 'review.event', 'event': 'done'})

        text = consumer.send.call_args[1]['text_data']
        parsed = json.loads(text)
        self.assertEqual(parsed['event'], 'done')


class ReplayEventLogTests(IsolatedAsyncioTestCase):
    """Tests for ReviewConsumer._replay_event_log()."""

    async def test_past_events_are_sent_to_client(self):
        consumer = ReviewConsumer()
        consumer.review_id = 'test-review-123'
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()

        past_events = [
            {'event': 'pipeline_start'},
            {'event': 'agent_done', 'agent': 'pragmatist', 'result': {}},
        ]
        mock_review = MagicMock()
        mock_review.event_log = past_events

        with patch('apps.reviews.models.Review') as MockReview:
            MockReview.objects.get.return_value = mock_review
            MockReview.DoesNotExist = Exception  # won't be raised in this test
            await consumer._replay_event_log()

        self.assertEqual(consumer.send.call_count, 2)

    async def test_events_sent_in_order(self):
        consumer = ReviewConsumer()
        consumer.review_id = 'test-id'
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()

        past_events = [
            {'event': 'pipeline_start'},
            {'event': 'agent_done', 'agent': 'pragmatist'},
            {'event': 'done'},
        ]
        mock_review = MagicMock()
        mock_review.event_log = past_events

        with patch('apps.reviews.models.Review') as MockReview:
            MockReview.objects.get.return_value = mock_review
            MockReview.DoesNotExist = Exception
            await consumer._replay_event_log()

        sent_events = [
            json.loads(c[1]['text_data'])['event']
            for c in consumer.send.call_args_list
        ]
        self.assertEqual(sent_events, ['pipeline_start', 'agent_done', 'done'])

    async def test_review_not_found_sends_error_and_closes(self):
        consumer = ReviewConsumer()
        consumer.review_id = 'nonexistent-id'
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()

        class FakeDoesNotExist(Exception):
            pass

        with patch('apps.reviews.models.Review') as MockReview:
            MockReview.DoesNotExist = FakeDoesNotExist
            MockReview.objects.get.side_effect = FakeDoesNotExist('not found')
            await consumer._replay_event_log()

        # Should send an error message then close
        consumer.close.assert_called_once()
        consumer.send.assert_called_once()
        sent = json.loads(consumer.send.call_args[1]['text_data'])
        self.assertEqual(sent['event'], 'error')

    async def test_empty_event_log_sends_nothing(self):
        consumer = ReviewConsumer()
        consumer.review_id = 'test-id'
        consumer.send = AsyncMock()
        consumer.close = AsyncMock()

        mock_review = MagicMock()
        mock_review.event_log = []

        with patch('apps.reviews.models.Review') as MockReview:
            MockReview.objects.get.return_value = mock_review
            MockReview.DoesNotExist = Exception
            await consumer._replay_event_log()

        consumer.send.assert_not_called()
        consumer.close.assert_not_called()
