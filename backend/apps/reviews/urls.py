from django.urls import path
from .views import HistoryView, ReviewDetailView, ReviewPDFView, ReviewShareView, ReviewSubmitView

urlpatterns = [
    path('',              ReviewSubmitView.as_view(), name='review_submit'),
    path('<uuid:review_id>/',      ReviewDetailView.as_view(), name='review_detail'),
    path('<uuid:review_id>/pdf/',  ReviewPDFView.as_view(),    name='review_pdf'),
    path('history/',      HistoryView.as_view(),      name='review_history'),
]
