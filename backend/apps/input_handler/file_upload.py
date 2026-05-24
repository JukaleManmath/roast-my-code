import logging
from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from pygments.lexers import guess_lexer, get_lexer_for_filename
from pygments.util import ClassNotFound
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


def handle_file_upload(file: UploadedFile, user_is_authenticated: bool) -> dict:
    """
    Validate and process an uploaded file.

    Returns a dict with raw_code, language, and filename.
    Raises ValidationError for invalid input.
    """
    if file.size > settings.MAX_UPLOAD_SIZE_BYTES:
        raise ValidationError(
            f'File size exceeds the {settings.MAX_UPLOAD_SIZE_BYTES // 1024}KB limit.'
        )

    try:
        raw_bytes = file.read()
        code = raw_bytes.decode('utf-8')
    except UnicodeDecodeError:
        raise ValidationError('File must be a UTF-8 encoded text file.')

    if not code.strip():
        raise ValidationError('Uploaded file is empty.')

    if len(code.strip()) < 10:
        raise ValidationError('File content is too short to review (minimum 10 characters).')

    max_lines = (
        settings.AUTHENTICATED_MAX_LINES
        if user_is_authenticated
        else settings.ANONYMOUS_MAX_LINES
    )

    lines = code.splitlines()
    if len(lines) > max_lines:
        raise ValidationError(
            f'File exceeds the {max_lines}-line limit. '
            f'{"Authenticated" if user_is_authenticated else "Anonymous"} users '
            f'may submit up to {max_lines} lines.'
        )

    filename = file.name or ''
    language = _detect_language(code, filename)

    logger.info(
        'File upload accepted: filename=%s, %d lines, language=%s',
        filename, len(lines), language,
    )

    return {
        'raw_code': code,
        'language': language,
        'filename': filename,
    }


def _detect_language(code: str, filename: str) -> str:
    # Try filename first — more reliable than content guessing
    if filename:
        try:
            lexer = get_lexer_for_filename(filename)
            return lexer.name
        except ClassNotFound:
            pass

    # Fall back to content-based detection
    try:
        lexer = guess_lexer(code)
        return lexer.name
    except ClassNotFound:
        return 'Unknown'
