import uuid
from django.conf import settings
from django.db import models


class Review(models.Model):

    class InputMode(models.TextChoices):
        PASTE  = 'paste',  'Paste'
        FILE   = 'file',   'File Upload'
        GITHUB = 'github', 'GitHub URL'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        DONE    = 'done',    'Done'
        FAILED  = 'failed',  'Failed'

    # Identity
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user        = models.ForeignKey(
                      settings.AUTH_USER_MODEL,
                      on_delete=models.SET_NULL,
                      null=True,
                      blank=True,
                      related_name='reviews',
                  )
    session_key = models.CharField(max_length=64, blank=True)

    # Input
    input_mode  = models.CharField(max_length=10, choices=InputMode.choices)
    language    = models.CharField(max_length=50, default='Unknown')
    raw_code    = models.TextField()
    github_url  = models.URLField(blank=True)
    filename    = models.CharField(max_length=255, blank=True)

    # Pipeline state
    status        = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    agent_results = models.JSONField(default=dict)
    synthesis     = models.JSONField(default=dict)
    event_log     = models.JSONField(default=list)
    error_message = models.TextField(blank=True)

    # Sharing
    share_slug = models.SlugField(max_length=12, unique=True, blank=True)

    # Timestamps
    created_at   = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'reviews'
        ordering = ['-created_at']

    def save(self, *args, **kwargs) -> None:
        if not self.share_slug:
            self._set_unique_slug()
        super().save(*args, **kwargs)

    def _set_unique_slug(self) -> None:
        from django.db import IntegrityError
        for _ in range(10):
            self.share_slug = uuid.uuid4().hex[:8]
            try:
                # Check uniqueness without saving
                if not Review.objects.filter(share_slug=self.share_slug).exists():
                    return
            except Exception:
                pass
        raise IntegrityError('Could not generate a unique share_slug after 10 attempts')

    def __str__(self) -> str:
        return f'Review {self.id} [{self.status}]'


class SavedReview(models.Model):
    user      = models.ForeignKey(
                    settings.AUTH_USER_MODEL,
                    on_delete=models.CASCADE,
                    related_name='saved_reviews',
                )
    review    = models.ForeignKey(
                    Review,
                    on_delete=models.CASCADE,
                    related_name='saved_by',
                )
    note      = models.TextField(blank=True)
    saved_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'saved_reviews'
        unique_together = ('user', 'review')   # can't save the same review twice
        ordering = ['-saved_at']

    def __str__(self) -> str:
        return f'{self.user} → {self.review_id}'
