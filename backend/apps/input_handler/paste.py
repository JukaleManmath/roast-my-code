import logging
from django.conf import settings
from pygments.lexers import guess_lexer
from pygments.util import ClassNotFound
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def handle_paste(code: str, user_is_authenticated: bool) -> dict:
    """
    Validate and process pasted code.

    Returns a dict with raw_code, language, and filename.
    Raises ValidationError for invalid input.
    """
    if not code or not code.strip():
        raise ValidationError('Code cannot be empty.')

    if len(code.strip()) < 10:
        raise ValidationError('Code is too short to review (minimum 10 characters).')

    max_lines = (
        settings.AUTHENTICATED_MAX_LINES
        if user_is_authenticated
        else settings.ANONYMOUS_MAX_LINES
    )

    lines = code.splitlines()
    if len(lines) > max_lines:
        raise ValidationError(
            f'Code exceeds the {max_lines}-line limit. '
            f'{"Authenticated" if user_is_authenticated else "Anonymous"} users '
            f'may submit up to {max_lines} lines.'
        )

    language = _detect_language(code)

    logger.info('Paste input accepted: %d lines, language=%s', len(lines), language)

    return {
        'raw_code': code,
        'language': language,
        'filename': '',
    }


def _detect_language(code: str) -> str:
    try:
        lexer = guess_lexer(code)
        return lexer.name
    except ClassNotFound:
        return 'Unknown'
