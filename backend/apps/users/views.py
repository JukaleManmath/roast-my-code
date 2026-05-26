import logging

from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UserSerializer

logger = logging.getLogger(__name__)
User = get_user_model()


class GoogleLoginView(APIView):
    """Exchange a Google authorization code for a JWT token pair."""
    permission_classes = (AllowAny,)

    def post(self, request: Request) -> Response:
        code = request.data.get('code')
        redirect_uri = request.data.get('redirect_uri', 'http://localhost:3000/auth/callback')

        if not code:
            return Response({'error': 'Authorization code required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            adapter = GoogleOAuth2Adapter(request)
            app = adapter.get_provider().app
            client = OAuth2Client(
                request=request,
                consumer_key=app.client_id,
                consumer_secret=app.secret,
                access_token_method=adapter.access_token_method,
                access_token_url=adapter.access_token_url,
                callback_url=redirect_uri,
            )
            token = client.get_access_token(code)
            social_token = adapter.parse_token(token)
            social_token.app = app
            social_login = adapter.complete_login(request, app, social_token, response=token)

            # Extract the fields we need from the allauth social login object.
            # We do NOT call complete_social_login / login.save() / login.connect() —
            # those are browser-redirect flows and break in a headless API.
            email: str = social_login.user.email
            uid: str = social_login.account.uid
            extra_data: dict = social_login.account.extra_data

            if not email:
                return Response({'error': 'Google account has no email address.'}, status=status.HTTP_400_BAD_REQUEST)

            # Atomically find or create the user row.
            # get_or_create uses SELECT FOR UPDATE internally, so concurrent requests
            # for the same email will not produce duplicate-key violations.
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={'username': ''},
            )

            # Atomically find or create the social account link.
            SocialAccount.objects.get_or_create(
                uid=uid,
                provider='google',
                defaults={'user': user, 'extra_data': extra_data},
            )

            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data,
            })
        except Exception as exc:
            logger.exception('Google login failed: %s', exc)
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """Return the currently authenticated user's profile."""
    permission_classes = (IsAuthenticated,)

    def get(self, request: Request) -> Response:
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
