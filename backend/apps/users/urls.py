from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import GoogleLoginView, MeView

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/social/google/', GoogleLoginView.as_view(), name='google_login'),
    path('auth/me/', MeView.as_view(), name='me'),
]
