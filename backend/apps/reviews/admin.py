from django.contrib import admin
from .models import Review, SavedReview


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ('id', 'status', 'language', 'input_mode', 'user', 'created_at')
    list_filter   = ('status', 'input_mode', 'language')
    search_fields = ('id', 'share_slug', 'user__email')
    readonly_fields = (
        'id', 'share_slug', 'agent_results', 'synthesis',
        'event_log', 'created_at', 'completed_at',
    )


@admin.register(SavedReview)
class SavedReviewAdmin(admin.ModelAdmin):
    list_display  = ('user', 'review', 'saved_at')
    search_fields = ('user__email',)
