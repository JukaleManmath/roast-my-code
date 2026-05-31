import uuid
from unittest.mock import MagicMock, call, patch

from django.test import TestCase

from apps.reviews.models import Review


def _make_review(**kwargs) -> Review:
    defaults = {
        'input_mode': Review.InputMode.PASTE,
        'raw_code': 'def hello():\n    return "world"\n',
        'language': 'Python',
    }
    defaults.update(kwargs)
    return Review.objects.create(**defaults)


def _fake_final_state() -> dict:
    agent_result = {
        'issues': [],
        'summary': 'All good.',
        'overall_severity': 'suggestion',
    }
    return {
        'pragmatist': agent_result,
        'paranoid':   agent_result,
        'minimalist': agent_result,
        'optimizer':  agent_result,
        'mentor':     agent_result,
        'synthesis': {
            'critical': [], 'warnings': [], 'suggestions': [],
            'conflicts': [], 'overall_score': 5, 'summary': 'Clean code.',
        },
    }


class RunReviewPipelineHappyPathTests(TestCase):
    """Tests for the successful execution path of the Celery task."""

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_task_sets_status_to_done(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.return_value = _fake_final_state()

        run_review_pipeline(str(review.id))

        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.DONE)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_task_persists_agent_results(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        final_state = _fake_final_state()
        mock_graph.invoke.return_value = final_state

        run_review_pipeline(str(review.id))

        review.refresh_from_db()
        for agent in ['pragmatist', 'paranoid', 'minimalist', 'optimizer', 'mentor']:
            self.assertIn(agent, review.agent_results)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_task_persists_synthesis(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.return_value = _fake_final_state()

        run_review_pipeline(str(review.id))

        review.refresh_from_db()
        self.assertEqual(review.synthesis['overall_score'], 5)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_task_sets_completed_at(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.return_value = _fake_final_state()

        run_review_pipeline(str(review.id))

        review.refresh_from_db()
        self.assertIsNotNone(review.completed_at)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_review_is_running_when_graph_is_invoked(self, mock_graph, mock_broadcast):
        """Status should be RUNNING by the time review_graph.invoke() is called."""
        from worker.tasks import run_review_pipeline
        review = _make_review()
        captured_status = []

        def fake_invoke(state: dict) -> dict:
            captured_status.append(Review.objects.get(id=review.id).status)
            return _fake_final_state()

        mock_graph.invoke.side_effect = fake_invoke
        run_review_pipeline(str(review.id))

        self.assertEqual(captured_status[0], Review.Status.RUNNING)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_broadcast_called_for_pipeline_start_and_done(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.return_value = _fake_final_state()

        run_review_pipeline(str(review.id))

        # Verify at least pipeline_start and done events were broadcast
        broadcast_events = [c[0][1]['event'] for c in mock_broadcast.call_args_list]
        self.assertIn('pipeline_start', broadcast_events)
        self.assertIn('done', broadcast_events)


class RunReviewPipelineMissingReviewTests(TestCase):
    """Task should silently abort when the Review row doesn't exist."""

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_nonexistent_review_id_does_not_raise(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        run_review_pipeline(str(uuid.uuid4()))

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_nonexistent_review_never_invokes_graph(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        run_review_pipeline(str(uuid.uuid4()))
        mock_graph.invoke.assert_not_called()


class RunReviewPipelineFailureTests(TestCase):
    """Tests for error handling when the pipeline raises."""

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_final_retry_sets_status_to_failed(self, mock_graph, mock_broadcast):
        """When retries == max_retries, status must be FAILED and error_message set."""
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.side_effect = Exception('Pipeline crashed')

        # Set max_retries=0 so the first execution IS the final retry
        # (self.request.retries starts at 0; 0 >= 0 → FAILED branch, no re-queue).
        original = run_review_pipeline.max_retries
        run_review_pipeline.max_retries = 0
        try:
            run_review_pipeline(str(review.id))
        finally:
            run_review_pipeline.max_retries = original

        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.FAILED)
        self.assertIn('Pipeline crashed', review.error_message)

    @patch('worker.tasks._broadcast')
    @patch('pipeline.graph.review_graph')
    def test_final_retry_broadcasts_error_event(self, mock_graph, mock_broadcast):
        from worker.tasks import run_review_pipeline
        review = _make_review()
        mock_graph.invoke.side_effect = Exception('crashed')

        original = run_review_pipeline.max_retries
        run_review_pipeline.max_retries = 0
        try:
            run_review_pipeline(str(review.id))
        finally:
            run_review_pipeline.max_retries = original

        error_broadcasts = [
            c for c in mock_broadcast.call_args_list
            if c[0][1].get('event') == 'error'
        ]
        self.assertGreater(len(error_broadcasts), 0)
