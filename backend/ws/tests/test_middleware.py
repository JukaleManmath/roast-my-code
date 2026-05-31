from asgiref.sync import sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from unittest import IsolatedAsyncioTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from ws.middleware import JWTAuthMiddleware

User = get_user_model()


class JWTAuthMiddlewareGetUserTests(IsolatedAsyncioTestCase):
    """Tests for JWTAuthMiddleware._get_user() — the core auth logic."""

    async def test_no_token_returns_anonymous_user(self):
        scope = {'query_string': b''}
        user = await JWTAuthMiddleware._get_user(scope)
        self.assertIsInstance(user, AnonymousUser)

    async def test_empty_token_returns_anonymous_user(self):
        scope = {'query_string': b'token='}
        user = await JWTAuthMiddleware._get_user(scope)
        self.assertIsInstance(user, AnonymousUser)

    async def test_garbage_token_returns_anonymous_user(self):
        scope = {'query_string': b'token=not.a.valid.jwt.token'}
        user = await JWTAuthMiddleware._get_user(scope)
        self.assertIsInstance(user, AnonymousUser)

    async def test_expired_looking_token_returns_anonymous_user(self):
        # A well-formed JWT but one that will fail validation
        fake_jwt = (
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'
            'eyJzdWIiOiIxMjM0NTY3ODkwIn0.'
            'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        )
        scope = {'query_string': f'token={fake_jwt}'.encode()}
        user = await JWTAuthMiddleware._get_user(scope)
        self.assertIsInstance(user, AnonymousUser)

    async def test_valid_token_returns_correct_user(self):
        db_user = await sync_to_async(User.objects.create_user)(
            email='ws_test@example.com', password='testpass123'
        )
        refresh = await sync_to_async(RefreshToken.for_user)(db_user)
        token_str = str(refresh.access_token)

        scope = {'query_string': f'token={token_str}'.encode()}
        result = await JWTAuthMiddleware._get_user(scope)

        self.assertFalse(isinstance(result, AnonymousUser))
        self.assertEqual(str(result.id), str(db_user.id))
        self.assertEqual(result.email, 'ws_test@example.com')

    async def test_token_for_deleted_user_returns_anonymous(self):
        """Token is valid but the user has since been deleted."""
        db_user = await sync_to_async(User.objects.create_user)(
            email='deleted@example.com', password='testpass123'
        )
        refresh = await sync_to_async(RefreshToken.for_user)(db_user)
        token_str = str(refresh.access_token)

        # Delete the user
        await sync_to_async(db_user.delete)()

        scope = {'query_string': f'token={token_str}'.encode()}
        result = await JWTAuthMiddleware._get_user(scope)
        self.assertIsInstance(result, AnonymousUser)
