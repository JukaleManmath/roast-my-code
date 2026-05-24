import logging
from django.conf import settings
from github import Github, GithubException
from pygments.lexers import get_lexer_for_filename, guess_lexer
from pygments.util import ClassNotFound
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

# File extensions we consider worth reviewing
_REVIEWABLE_EXTENSIONS = {
    '.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.rs', '.java',
    '.c', '.cpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala',
    '.sh', '.bash', '.sql', '.html', '.css', '.yml', '.yaml',
}


def handle_github_url(url: str, user_is_authenticated: bool) -> dict:
    """
    Fetch a file from GitHub and return its contents.

    Supports:
    - Single file URL: github.com/owner/repo/blob/branch/path/to/file.py
    - Repo URL: github.com/owner/repo  (auto-selects best file)

    Raises ValidationError for invalid URLs, rate limits, or auth errors.
    """
    token = settings.GITHUB_TOKEN or None
    client = Github(token)

    try:
        owner, repo_name, branch, filepath = _parse_github_url(url)
        repo = client.get_repo(f'{owner}/{repo_name}')

        if filepath:
            return _fetch_single_file(repo, filepath, branch, user_is_authenticated)
        else:
            return _fetch_best_file(repo, user_is_authenticated)

    except GithubException as exc:
        _handle_github_exception(exc)


def _parse_github_url(url: str) -> tuple[str, str, str, str]:
    """
    Parse a GitHub URL into (owner, repo, branch, filepath).
    filepath is empty string for repo-level URLs.
    """
    # Strip protocol and domain
    url = url.strip().rstrip('/')
    for prefix in ('https://github.com/', 'http://github.com/', 'github.com/'):
        if url.startswith(prefix):
            url = url[len(prefix):]
            break
    else:
        raise ValidationError('Invalid GitHub URL. Must start with https://github.com/')

    parts = url.split('/')

    if len(parts) < 2:
        raise ValidationError('Invalid GitHub URL. Expected github.com/owner/repo')

    owner    = parts[0]
    repo     = parts[1]
    branch   = ''
    filepath = ''

    # github.com/owner/repo/blob/branch/path/to/file
    if len(parts) > 4 and parts[2] == 'blob':
        branch   = parts[3]
        filepath = '/'.join(parts[4:])
    elif len(parts) > 2:
        raise ValidationError(
            'Invalid GitHub URL. Use a direct file URL '
            '(github.com/owner/repo/blob/branch/file) or a repo URL (github.com/owner/repo).'
        )

    return owner, repo, branch, filepath


def _fetch_single_file(repo, filepath: str, branch: str, user_is_authenticated: bool) -> dict:
    try:
        kwargs = {'ref': branch} if branch else {}
        content = repo.get_contents(filepath, **kwargs)
    except GithubException as exc:
        if exc.status == 404:
            raise ValidationError(f'File not found in repository: {filepath}')
        raise

    code = content.decoded_content.decode('utf-8')
    return _validate_and_build(code, filepath, user_is_authenticated)


def _fetch_best_file(repo, user_is_authenticated: bool) -> dict:
    """Auto-select the most interesting reviewable file from a repo."""
    try:
        contents = repo.get_contents('')
    except GithubException as exc:
        if exc.status == 404:
            raise ValidationError('Repository not found or is empty.')
        raise

    # Prefer files with reviewable extensions, largest first (more code to review)
    candidates = [
        f for f in contents
        if f.type == 'file' and _is_reviewable(f.name)
    ]

    if not candidates:
        raise ValidationError(
            'No reviewable source files found in the repository root. '
            'Provide a direct file URL instead.'
        )

    best = max(candidates, key=lambda f: f.size)
    code = best.decoded_content.decode('utf-8')
    return _validate_and_build(code, best.name, user_is_authenticated)


def _validate_and_build(code: str, filename: str, user_is_authenticated: bool) -> dict:
    if not code.strip():
        raise ValidationError('The file is empty.')

    if len(code.strip()) < 10:
        raise ValidationError('File content is too short to review (minimum 10 characters).')

    max_lines = (
        settings.AUTHENTICATED_MAX_LINES
        if user_is_authenticated
        else settings.ANONYMOUS_MAX_LINES
    )

    lines = code.splitlines()
    if len(lines) > max_lines:
        # Truncate rather than reject — better UX for GitHub files
        code = '\n'.join(lines[:max_lines])
        logger.info('GitHub file truncated to %d lines', max_lines)

    language = _detect_language(code, filename)

    logger.info('GitHub fetch accepted: filename=%s, language=%s', filename, language)

    return {
        'raw_code': code,
        'language': language,
        'filename': filename,
    }


def _detect_language(code: str, filename: str) -> str:
    if filename:
        try:
            return get_lexer_for_filename(filename).name
        except ClassNotFound:
            pass
    try:
        return guess_lexer(code).name
    except ClassNotFound:
        return 'Unknown'


def _is_reviewable(filename: str) -> bool:
    return any(filename.endswith(ext) for ext in _REVIEWABLE_EXTENSIONS)


def _handle_github_exception(exc: GithubException) -> None:
    if exc.status == 401:
        raise ValidationError('GitHub authentication failed. The repository may be private.')
    if exc.status == 403:
        raise ValidationError(
            'GitHub API rate limit exceeded. '
            'Try again later or provide a GitHub token.'
        )
    if exc.status == 404:
        raise ValidationError('Repository or file not found on GitHub.')
    if exc.status == 429:
        raise ValidationError('GitHub API rate limit exceeded. Try again later.')
    logger.error('Unexpected GitHub API error: status=%s data=%s', exc.status, exc.data)
    raise ValidationError('Failed to fetch from GitHub. Please try again.')
