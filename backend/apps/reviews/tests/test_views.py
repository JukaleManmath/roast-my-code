import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.reviews.models import Review

User = get_user_model()

# Code long enough to pass the 10-char minimum and not trip line limits
VALID_CODE = 'def hello():\n    return "world"\n' * 3


class ReviewSubmitViewTests(TestCase):
    """POST /api/reviews/"""

    def setUp(self):
        self.client = APIClient()
        self.url = '/api/reviews/'

    @patch('worker.tasks.run_review_pipeline')
    def test_paste_mode_creates_review_and_returns_201(self, mock_task):
        mock_task.delay = MagicMock()
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': VALID_CODE,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertIn('id', resp.data)
        self.assertEqual(resp.data['status'], 'pending')
        mock_task.delay.assert_called_once()

    @patch('worker.tasks.run_review_pipeline')
    def test_invalid_input_mode_returns_400(self, mock_task):
        resp = self.client.post(self.url, {
            'input_mode': 'magic',
            'code': VALID_CODE,
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        mock_task.delay.assert_not_called()

    @patch('worker.tasks.run_review_pipeline')
    def test_file_mode_without_file_returns_400(self, mock_task):
        resp = self.client.post(self.url, {'input_mode': 'file'}, format='multipart')
        self.assertEqual(resp.status_code, 400)

    @patch('worker.tasks.run_review_pipeline')
    def test_code_too_short_returns_400(self, mock_task):
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': 'abc',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    @patch('worker.tasks.run_review_pipeline')
    def test_language_override_is_persisted(self, mock_task):
        mock_task.delay = MagicMock()
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': VALID_CODE,
            'language': 'Rust',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        review = Review.objects.get(id=resp.data['id'])
        self.assertEqual(review.language, 'Rust')

    @patch('worker.tasks.run_review_pipeline')
    def test_authenticated_user_is_linked_to_review(self, mock_task):
        mock_task.delay = MagicMock()
        user = User.objects.create_user(email='owner@test.com', password='pass')
        self.client.force_authenticate(user=user)
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': VALID_CODE,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        review = Review.objects.get(id=resp.data['id'])
        self.assertEqual(review.user, user)

    @patch('worker.tasks.run_review_pipeline')
    def test_anonymous_review_has_null_user_and_session_key(self, mock_task):
        mock_task.delay = MagicMock()
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': VALID_CODE,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        review = Review.objects.get(id=resp.data['id'])
        self.assertIsNone(review.user)
        self.assertNotEqual(review.session_key, '')

    @patch('worker.tasks.run_review_pipeline')
    def test_celery_task_dispatched_with_review_id(self, mock_task):
        mock_task.delay = MagicMock()
        resp = self.client.post(self.url, {
            'input_mode': 'paste',
            'code': VALID_CODE,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        review_id = resp.data['id']
        mock_task.delay.assert_called_once_with(review_id)


class ReviewDetailViewTests(TestCase):
    """GET / DELETE /api/reviews/{id}/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='owner@test.com', password='pass')
        self.review = Review.objects.create(
            user=self.user,
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
        )

    def test_get_existing_review_returns_200(self):
        resp = self.client.get(f'/api/reviews/{self.review.id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(str(resp.data['id']), str(self.review.id))

    def test_get_nonexistent_review_returns_404(self):
        resp = self.client.get(f'/api/reviews/{uuid.uuid4()}/')
        self.assertEqual(resp.status_code, 404)

    def test_delete_by_owner_returns_204_and_removes_review(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(f'/api/reviews/{self.review.id}/')
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())

    def test_delete_by_non_owner_returns_403(self):
        other = User.objects.create_user(email='other@test.com', password='pass')
        self.client.force_authenticate(user=other)
        resp = self.client.delete(f'/api/reviews/{self.review.id}/')
        self.assertEqual(resp.status_code, 403)
        # Review should still exist
        self.assertTrue(Review.objects.filter(id=self.review.id).exists())

    def test_delete_unauthenticated_returns_401(self):
        resp = self.client.delete(f'/api/reviews/{self.review.id}/')
        self.assertEqual(resp.status_code, 401)


class ReviewShareViewTests(TestCase):
    """GET /api/r/{slug}/"""

    def setUp(self):
        self.client = APIClient()
        self.done_review = Review.objects.create(
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
            status=Review.Status.DONE,
        )
        self.pending_review = Review.objects.create(
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
            status=Review.Status.PENDING,
        )

    def test_done_review_accessible_by_slug(self):
        resp = self.client.get(f'/api/r/{self.done_review.share_slug}/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('agent_results', resp.data)

    def test_pending_review_slug_returns_404(self):
        resp = self.client.get(f'/api/r/{self.pending_review.share_slug}/')
        self.assertEqual(resp.status_code, 404)

    def test_failed_review_slug_returns_404(self):
        failed = Review.objects.create(
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
            status=Review.Status.FAILED,
        )
        resp = self.client.get(f'/api/r/{failed.share_slug}/')
        self.assertEqual(resp.status_code, 404)

    def test_unknown_slug_returns_404(self):
        resp = self.client.get('/api/r/doesnotexist/')
        self.assertEqual(resp.status_code, 404)

    def test_share_view_requires_no_auth(self):
        # Verify it works for completely anonymous clients
        resp = self.client.get(f'/api/r/{self.done_review.share_slug}/')
        self.assertEqual(resp.status_code, 200)


class ReviewPDFViewTests(TestCase):
    """GET /api/reviews/{id}/pdf/"""

    def setUp(self):
        self.client = APIClient()

    def test_pdf_for_pending_review_returns_404(self):
        review = Review.objects.create(
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
            status=Review.Status.PENDING,
        )
        resp = self.client.get(f'/api/reviews/{review.id}/pdf/')
        self.assertEqual(resp.status_code, 404)

    @patch('apps.reviews.views.generate_pdf')
    def test_pdf_for_done_review_calls_pdf_generator(self, mock_generate):
        from django.http import HttpResponse
        mock_generate.return_value = HttpResponse(
            b'%PDF-1.4', content_type='application/pdf'
        )
        review = Review.objects.create(
            input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE,
            language='Python',
            status=Review.Status.DONE,
        )
        resp = self.client.get(f'/api/reviews/{review.id}/pdf/')
        self.assertEqual(resp.status_code, 200)
        mock_generate.assert_called_once_with(review)


class HistoryViewTests(TestCase):
    """GET /api/reviews/history/"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='history@test.com', password='pass')

    def test_unauthenticated_request_is_rejected(self):
        resp = self.client.get('/api/reviews/history/')
        self.assertIn(resp.status_code, (401, 403))

    def test_returns_only_authenticated_users_reviews(self):
        other = User.objects.create_user(email='other@test.com', password='pass')
        # Create one review for each user
        Review.objects.create(
            user=self.user, input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE, language='Python',
        )
        Review.objects.create(
            user=other, input_mode=Review.InputMode.PASTE,
            raw_code=VALID_CODE, language='Python',
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/reviews/history/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    def test_returns_multiple_reviews_in_order(self):
        for _ in range(3):
            Review.objects.create(
                user=self.user, input_mode=Review.InputMode.PASTE,
                raw_code=VALID_CODE, language='Python',
            )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/reviews/history/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 3)
