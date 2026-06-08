from rest_framework import serializers
from .models import Review, SavedReview


class ReviewSerializer(serializers.ModelSerializer):
    """Used when submitting code — returns just enough to open the WebSocket."""

    class Meta:
        model = Review
        fields = (
            'id',
            'status',
            'input_mode',
            'language',
            'filename',
            'github_url',
            'share_slug',
            'created_at',
        )
        read_only_fields = fields


class ReviewDetailSerializer(serializers.ModelSerializer):
    """Used when fetching a full review — includes agent results and synthesis."""

    class Meta:
        model = Review
        fields = (
            'id',
            'status',
            'input_mode',
            'language',
            'raw_code',
            'filename',
            'github_url',
            'agent_results',
            'synthesis',
            'error_message',
            'share_slug',
            'created_at',
            'completed_at',
        )
        read_only_fields = fields


class SavedReviewSerializer(serializers.ModelSerializer):
    review = ReviewDetailSerializer(read_only=True)

    class Meta:
        model = SavedReview
        fields = ('id', 'review', 'note', 'saved_at')
        read_only_fields = ('id', 'saved_at')
