import os

# Must be set before base.py reads them via django-environ
os.environ.setdefault('SECRET_KEY', 'django-insecure-test-key-not-for-production')
os.environ.setdefault('DATABASE_URL', 'sqlite:///test_temp.db')
os.environ.setdefault('GROQ_API_KEY', 'test-groq-key')
os.environ.setdefault('GITHUB_TOKEN', '')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('REDIS_CACHE_URL', 'redis://localhost:6379/3')
os.environ.setdefault('REDIS_CELERY_BROKER', 'redis://localhost:6379/1')
os.environ.setdefault('REDIS_CELERY_BACKEND', 'redis://localhost:6379/2')

from .base import *  # noqa: F401, E402

# SQLite in-memory: avoids needing a real PostgreSQL instance.
# NOTE: tests that rely on PostgreSQL-specific SQL (::jsonb operator in event_log
# appends) should mock _broadcast / _broadcast_agent_done / _broadcast_synthesis_done.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# In-memory channel layer — no Redis required for tests
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# Celery: run tasks synchronously in tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Avoid real Redis for caching
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# Keep throttle keys present (AnonRateThrottle/UserRateThrottle look them up by scope name
# even when overriding throttle_classes on individual views). Set very high limits so
# tests never actually get rate-limited.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]  # noqa: F821
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100000/day',
        'user': '100000/day',
    },
}

# Faster password hashing in tests
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
