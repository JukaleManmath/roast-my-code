from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from github import GithubException
from rest_framework.exceptions import ValidationError

from apps.input_handler.github_fetch import (
    _is_reviewable,
    _parse_github_url,
    _validate_and_build,
    handle_github_url,
)


class ParseGithubUrlTests(TestCase):

    def test_file_url_parsed_correctly(self):
        url = 'https://github.com/owner/repo/blob/main/path/to/file.py'
        owner, repo, branch, filepath = _parse_github_url(url)
        self.assertEqual(owner, 'owner')
        self.assertEqual(repo, 'repo')
        self.assertEqual(branch, 'main')
        self.assertEqual(filepath, 'path/to/file.py')

    def test_repo_url_returns_empty_branch_and_filepath(self):
        url = 'https://github.com/owner/repo'
        owner, repo, branch, filepath = _parse_github_url(url)
        self.assertEqual(owner, 'owner')
        self.assertEqual(repo, 'repo')
        self.assertEqual(branch, '')
        self.assertEqual(filepath, '')

    def test_trailing_slash_is_stripped(self):
        url = 'https://github.com/owner/repo/'
        owner, repo, branch, filepath = _parse_github_url(url)
        self.assertEqual(owner, 'owner')
        self.assertEqual(repo, 'repo')
        self.assertEqual(filepath, '')

    def test_http_prefix_accepted(self):
        url = 'http://github.com/owner/repo'
        owner, repo, branch, filepath = _parse_github_url(url)
        self.assertEqual(owner, 'owner')

    def test_non_github_prefix_raises(self):
        with self.assertRaises(ValidationError):
            _parse_github_url('https://gitlab.com/owner/repo')

    def test_missing_repo_segment_raises(self):
        with self.assertRaises(ValidationError):
            _parse_github_url('https://github.com/owner')

    def test_extra_path_without_blob_raises(self):
        # github.com/owner/repo/tree/main is not a file URL
        with self.assertRaises(ValidationError):
            _parse_github_url('https://github.com/owner/repo/tree/main')

    def test_nested_file_path_preserved(self):
        url = 'https://github.com/owner/repo/blob/main/src/utils/helper.py'
        _, _, _, filepath = _parse_github_url(url)
        self.assertEqual(filepath, 'src/utils/helper.py')


@override_settings(ANONYMOUS_MAX_LINES=200, AUTHENTICATED_MAX_LINES=500)
class ValidateAndBuildTests(TestCase):

    def test_empty_content_raises(self):
        with self.assertRaises(ValidationError):
            _validate_and_build('   ', 'test.py', False)

    def test_too_short_content_raises(self):
        with self.assertRaises(ValidationError):
            _validate_and_build('abc', 'test.py', False)

    def test_over_anon_limit_is_truncated_not_rejected(self):
        code = '\n'.join(['x = 1'] * 250)  # 250 lines, anon limit is 200
        result = _validate_and_build(code, 'test.py', False)
        self.assertEqual(len(result['raw_code'].splitlines()), 200)

    def test_within_limit_is_not_truncated(self):
        code = '\n'.join(['x = 1'] * 100)
        result = _validate_and_build(code, 'test.py', False)
        self.assertEqual(len(result['raw_code'].splitlines()), 100)

    def test_auth_limit_allows_more_lines_before_truncation(self):
        code = '\n'.join(['x = 1'] * 450)  # Within auth limit of 500
        result = _validate_and_build(code, 'test.py', True)
        self.assertEqual(len(result['raw_code'].splitlines()), 450)

    def test_result_contains_required_keys(self):
        code = 'def hello():\n    return "world"\n'
        result = _validate_and_build(code, 'hello.py', False)
        self.assertIn('raw_code', result)
        self.assertIn('language', result)
        self.assertIn('filename', result)
        self.assertEqual(result['filename'], 'hello.py')


class IsReviewableTests(TestCase):

    def test_python_is_reviewable(self):
        self.assertTrue(_is_reviewable('main.py'))

    def test_typescript_is_reviewable(self):
        self.assertTrue(_is_reviewable('app.ts'))

    def test_tsx_is_reviewable(self):
        self.assertTrue(_is_reviewable('Component.tsx'))

    def test_go_is_reviewable(self):
        self.assertTrue(_is_reviewable('server.go'))

    def test_markdown_is_not_reviewable(self):
        self.assertFalse(_is_reviewable('README.md'))

    def test_txt_is_not_reviewable(self):
        self.assertFalse(_is_reviewable('notes.txt'))

    def test_json_is_not_reviewable(self):
        self.assertFalse(_is_reviewable('package.json'))


@override_settings(GITHUB_TOKEN='', ANONYMOUS_MAX_LINES=200, AUTHENTICATED_MAX_LINES=500)
class HandleGithubUrlTests(TestCase):

    def test_non_github_url_raises(self):
        with self.assertRaises(ValidationError):
            handle_github_url('https://gitlab.com/owner/repo', False)

    @patch('apps.input_handler.github_fetch.Github')
    def test_401_raises_private_repo_error(self, MockGithub):
        exc = GithubException(401, {'message': 'Bad credentials'}, None)
        MockGithub.return_value.get_repo.side_effect = exc
        with self.assertRaises(ValidationError) as ctx:
            handle_github_url('https://github.com/owner/repo', False)
        self.assertIn('private', str(ctx.exception.detail[0]).lower())

    @patch('apps.input_handler.github_fetch.Github')
    def test_403_raises_rate_limit_error(self, MockGithub):
        exc = GithubException(403, {'message': 'API rate limit exceeded'}, None)
        MockGithub.return_value.get_repo.side_effect = exc
        with self.assertRaises(ValidationError) as ctx:
            handle_github_url('https://github.com/owner/repo', False)
        self.assertIn('rate limit', str(ctx.exception.detail[0]).lower())

    @patch('apps.input_handler.github_fetch.Github')
    def test_404_raises_not_found_error(self, MockGithub):
        exc = GithubException(404, {'message': 'Not Found'}, None)
        MockGithub.return_value.get_repo.side_effect = exc
        with self.assertRaises(ValidationError) as ctx:
            handle_github_url('https://github.com/owner/repo', False)
        self.assertIn('not found', str(ctx.exception.detail[0]).lower())

    @patch('apps.input_handler.github_fetch.Github')
    def test_429_raises_rate_limit_error(self, MockGithub):
        exc = GithubException(429, {'message': 'Too Many Requests'}, None)
        MockGithub.return_value.get_repo.side_effect = exc
        with self.assertRaises(ValidationError) as ctx:
            handle_github_url('https://github.com/owner/repo', False)
        self.assertIn('rate limit', str(ctx.exception.detail[0]).lower())

    @patch('apps.input_handler.github_fetch.Github')
    def test_successful_file_fetch_returns_dict(self, MockGithub):
        code = 'def hello():\n    return "world"\n'
        mock_content = MagicMock()
        mock_content.decoded_content = code.encode()

        mock_repo = MagicMock()
        mock_repo.get_contents.return_value = mock_content
        MockGithub.return_value.get_repo.return_value = mock_repo

        result = handle_github_url(
            'https://github.com/owner/repo/blob/main/hello.py', False
        )
        self.assertEqual(result['raw_code'], code)
        self.assertEqual(result['filename'], 'hello.py')
