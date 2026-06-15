from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from apps.reviews.views import ReviewShareView


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('api/health/', health),
    path('admin/', admin.site.urls),
    path('api/reviews/', include('apps.reviews.urls')),
    path('api/r/<slug:slug>/', ReviewShareView.as_view(), name='review_share'),
    path('api/', include('apps.users.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
