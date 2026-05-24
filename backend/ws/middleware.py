from channels.middleware import BaseMiddleware


class JWTAuthMiddleware(BaseMiddleware):
    """
    JWT authentication for WebSocket connections.
    Full implementation in Step 9.
    Reads token from ?token= query param and populates scope['user'].
    """

    async def __call__(self, scope, receive, send):
        # Stub — passes through without auth until Step 9
        await super().__call__(scope, receive, send)
