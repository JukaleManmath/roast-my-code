import logging
from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

logger = logging.getLogger(__name__)


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT authentication for WebSocket connections (correction #15).

    Django's AuthMiddlewareStack uses session cookies — unusable for a
    Next.js SPA sending JWTs. This middleware reads the token from the
    ?token= query parameter and populates scope['user'].

    Usage: ws://localhost:8000/ws/reviews/{id}/?token=<access_token>
    """

    async def __call__(self, scope, receive, send) -> None:
        scope['user'] = await self._get_user(scope)
        await super().__call__(scope, receive, send)

    @staticmethod
    async def _get_user(scope):
        from asgiref.sync import sync_to_async
        from django.contrib.auth import get_user_model

        query_string = scope.get('query_string', b'').decode()
        params       = parse_qs(query_string)
        token_list   = params.get('token', [])

        if not token_list:
            return AnonymousUser()

        token_str = token_list[0]

        try:
            token   = AccessToken(token_str)
            user_id = token['user_id']
            User    = get_user_model()
            user    = await sync_to_async(User.objects.get)(id=user_id)
            return user
        except (TokenError, Exception) as exc:
            logger.warning('WebSocket JWT auth failed: %s', exc)
            return AnonymousUser()
