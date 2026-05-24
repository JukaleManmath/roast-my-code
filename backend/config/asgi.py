import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

# get_asgi_application() must be called before any ORM or app imports
django_asgi_app = get_asgi_application()

# These imports must come AFTER get_asgi_application() so Django is fully
# initialised before ws modules are loaded (Step 9 creates these files)
from ws.middleware import JWTAuthMiddleware  # noqa: E402
from ws.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
