from unittest.mock import MagicMock, patch

from django.db import IntegrityError
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


class ReviewSlugTests(TestCase):

    def test_share_slug_auto_generated_on_create(self):
        review = _make_review()
        self.assertTrue(review.share_slug)
        self.assertGreaterEqual(len(review.share_slug), 6)

    def test_share_slug_is_unique_across_reviews(self):
        r1 = _make_review()
        r2 = _make_review()
        self.assertNotEqual(r1.share_slug, r2.share_slug)

    def test_existing_slug_not_overwritten_on_subsequent_save(self):
        review = _make_review()
        original_slug = review.share_slug
        review.status = Review.Status.RUNNING
        review.save(update_fields=['status'])
        review.refresh_from_db()
        self.assertEqual(review.share_slug, original_slug)

    def test_slug_collision_exhaustion_raises_integrity_error(self):
        """_set_unique_slug raises IntegrityError after all 10 attempts collide."""
        review = Review(
            input_mode=Review.InputMode.PASTE,
            raw_code='def hello():\n    return "world"\n',
            language='Python',
        )
        # Simulate every candidate slug already existing
        with patch('apps.reviews.models.Review.objects') as mock_manager:
            mock_qs = MagicMock()
            mock_qs.exists.return_value = True
            mock_manager.filter.return_value = mock_qs
            with self.assertRaises(IntegrityError):
                review._set_unique_slug()


class ReviewDefaultsTests(TestCase):

    def test_default_status_is_pending(self):
        review = _make_review()
        self.assertEqual(review.status, Review.Status.PENDING)

    def test_default_agent_results_is_empty_dict(self):
        review = _make_review()
        self.assertEqual(review.agent_results, {})

    def test_default_synthesis_is_empty_dict(self):
        review = _make_review()
        self.assertEqual(review.synthesis, {})

    def test_default_event_log_is_empty_list(self):
        review = _make_review()
        self.assertEqual(review.event_log, [])

    def test_str_representation_includes_status(self):
        review = _make_review()
        self.assertIn('pending', str(review))

    def test_anonymous_review_has_no_user(self):
        review = _make_review()
        self.assertIsNone(review.user)


class ReviewStatusTransitionTests(TestCase):

    def test_status_can_be_updated_to_running(self):
        review = _make_review()
        review.status = Review.Status.RUNNING
        review.save(update_fields=['status'])
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.RUNNING)

    def test_status_can_be_updated_to_done(self):
        review = _make_review()
        review.status = Review.Status.DONE
        review.save(update_fields=['status'])
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.DONE)

    def test_status_can_be_updated_to_failed(self):
        review = _make_review()
        review.status = Review.Status.FAILED
        review.error_message = 'Something broke'
        review.save(update_fields=['status', 'error_message'])
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.FAILED)
        self.assertEqual(review.error_message, 'Something broke')
