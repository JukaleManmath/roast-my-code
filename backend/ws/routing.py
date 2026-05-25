from django.urls import re_path
from ws.consumers import ReviewConsumer

websocket_urlpatterns = [
    re_path(r'^ws/reviews/(?P<review_id>[^/]+)/$', ReviewConsumer.as_asgi()),
]
