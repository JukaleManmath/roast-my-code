import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.export.pdf import generate_pdf
from apps.input_handler.file_upload import handle_file_upload
from apps.input_handler.github_fetch import handle_github_url
from apps.input_handler.paste import handle_paste
from .models import Review, SavedReview
from .serializers import ReviewDetailSerializer, ReviewSerializer, SavedReviewSerializer

logger = logging.getLogger(__name__)


def _review_rate(group: str, request: Request) -> str:
    """Return daily rate limit based on auth status."""
    if request.user.is_authenticated:
        return f'{settings.AUTHENTICATED_DAILY_LIMIT}/d'
    return f'{settings.ANONYMOUS_DAILY_LIMIT}/d'


@method_decorator(
    ratelimit(key='user_or_ip', rate=_review_rate, method='POST', block=True),
    name='dispatch',
)
class ReviewSubmitView(APIView):
    """POST /api/reviews/ — submit code for review."""
    permission_classes = (IsAuthenticatedOrReadOnly,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def post(self, request: Request) -> Response:
        input_mode = request.data.get('input_mode')
        if input_mode not in Review.InputMode.values:
            raise ValidationError(
                f'input_mode must be one of: {", ".join(Review.InputMode.values)}'
            )

        user_is_authenticated = request.user.is_authenticated

        # Route to the correct input handler
        if input_mode == Review.InputMode.PASTE:
            code_data = handle_paste(
                code=request.data.get('code', ''),
                user_is_authenticated=user_is_authenticated,
            )

        elif input_mode == Review.InputMode.FILE:
            file = request.FILES.get('file')
            if not file:
                raise ValidationError('No file provided.')
            code_data = handle_file_upload(
                file=file,
                user_is_authenticated=user_is_authenticated,
            )

        elif input_mode == Review.InputMode.GITHUB:
            code_data = handle_github_url(
                url=request.data.get('github_url', ''),
                user_is_authenticated=user_is_authenticated,
            )

        # Resolve anonymous user session key (correction #13)
        session_key = ''
        if not user_is_authenticated:
            if not request.session.session_key:
                request.session.create()
            session_key = request.session.session_key

        # Create review row
        review = Review.objects.create(
            user=request.user if user_is_authenticated else None,
            session_key=session_key,
            input_mode=input_mode,
            raw_code=code_data['raw_code'],
            language=code_data['language'],
            filename=code_data['filename'],
            github_url=request.data.get('github_url', ''),
            status=Review.Status.PENDING,
        )

        # Dispatch Celery task (implemented in Step 8)
        # Imported here to avoid circular import at module level
        from worker.tasks import run_review_pipeline
        run_review_pipeline.delay(str(review.id))

        logger.info('Review %s created, task dispatched', review.id)

        serializer = ReviewSerializer(review)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ReviewDetailView(APIView):
    """GET /api/reviews/{id}/ — fetch review status and results."""
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get(self, request: Request, review_id: str) -> Response:
        review = get_object_or_404(Review, id=review_id)
        serializer = ReviewDetailSerializer(review)
        return Response(serializer.data)


class ReviewShareView(APIView):
    """GET /api/r/{slug}/ — public share page, no auth required."""
    permission_classes = []

    def get(self, request: Request, slug: str) -> Response:
        review = get_object_or_404(Review, share_slug=slug, status=Review.Status.DONE)
        serializer = ReviewDetailSerializer(review)
        return Response(serializer.data)


class ReviewPDFView(APIView):
    """GET /api/reviews/{id}/pdf/ — download PDF report."""
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def get(self, request: Request, review_id: str) -> Response:
        review = get_object_or_404(Review, id=review_id, status=Review.Status.DONE)
        return generate_pdf(review)


class HistoryView(APIView):
    """GET /api/history/ — authenticated user's review history."""
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        reviews = Review.objects.filter(user=request.user).order_by('-created_at')
        serializer = ReviewSerializer(reviews, many=True)
        return Response(serializer.data)
