import io

from django.core.files.uploadedfile import InMemoryUploadedFile
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.input_handler.file_upload import handle_file_upload, _detect_language


def make_uploaded_file(
    content: bytes,
    filename: str = 'test.py',
    reported_size: int | None = None,
) -> InMemoryUploadedFile:
    """Helper: build an InMemoryUploadedFile from raw bytes."""
    buf = io.BytesIO(content)
    return InMemoryUploadedFile(
        file=buf,
        field_name='file',
        name=filename,
        content_type='text/plain',
        size=reported_size if reported_size is not None else len(content),
        charset=None,
    )


@override_settings(MAX_UPLOAD_SIZE_BYTES=102400, ANONYMOUS_MAX_LINES=200, AUTHENTICATED_MAX_LINES=500)
class HandleFileUploadTests(TestCase):

    # ------------------------------------------------------------------ #
    # Size / encoding rejection                                            #
    # ------------------------------------------------------------------ #

    def test_file_over_size_limit_raises(self):
        # Report a size that exceeds the 100KB limit
        content = b'x = 1\n' * 100
        file = make_uploaded_file(content, reported_size=102401)
        with self.assertRaises(ValidationError) as ctx:
            handle_file_upload(file, user_is_authenticated=False)
        self.assertIn('100', str(ctx.exception.detail[0]))

    def test_binary_file_raises(self):
        content = b'\x00\x01\x02\xff\xfe\xfd'
        file = make_uploaded_file(content, filename='binary.bin')
        with self.assertRaises(ValidationError) as ctx:
            handle_file_upload(file, user_is_authenticated=False)
        self.assertIn('UTF-8', str(ctx.exception.detail[0]))

    def test_empty_file_raises(self):
        file = make_uploaded_file(b'   \n  ', filename='empty.py')
        with self.assertRaises(ValidationError):
            handle_file_upload(file, user_is_authenticated=False)

    def test_content_too_short_raises(self):
        file = make_uploaded_file(b'abc', filename='short.py')
        with self.assertRaises(ValidationError) as ctx:
            handle_file_upload(file, user_is_authenticated=False)
        self.assertIn('too short', str(ctx.exception.detail[0]).lower())

    # ------------------------------------------------------------------ #
    # Line limit rejection                                                 #
    # ------------------------------------------------------------------ #

    def test_anonymous_over_line_limit_raises(self):
        code = ('\n'.join(['x = 1'] * 201)).encode()
        file = make_uploaded_file(code, filename='big.py')
        with self.assertRaises(ValidationError) as ctx:
            handle_file_upload(file, user_is_authenticated=False)
        self.assertIn('200', str(ctx.exception.detail[0]))

    def test_authenticated_over_line_limit_raises(self):
        code = ('\n'.join(['x = 1'] * 501)).encode()
        file = make_uploaded_file(code, filename='big.py')
        with self.assertRaises(ValidationError) as ctx:
            handle_file_upload(file, user_is_authenticated=True)
        self.assertIn('500', str(ctx.exception.detail[0]))

    # ------------------------------------------------------------------ #
    # Acceptance + metadata                                                #
    # ------------------------------------------------------------------ #

    def test_valid_python_file_returns_dict(self):
        code = 'def hello():\n    return "world"\n'
        file = make_uploaded_file(code.encode(), filename='hello.py')
        result = handle_file_upload(file, user_is_authenticated=False)
        self.assertEqual(result['raw_code'], code)
        self.assertEqual(result['filename'], 'hello.py')
        self.assertIsInstance(result['language'], str)

    def test_language_detected_from_filename_takes_priority(self):
        # .py extension → Python, regardless of content
        code = 'fn main() {} // rust-like but .py filename'
        file = make_uploaded_file(code.encode(), filename='app.py')
        result = handle_file_upload(file, user_is_authenticated=False)
        self.assertEqual(result['language'], 'Python')

    def test_authenticated_can_exceed_anon_limit(self):
        code = ('\n'.join(['x = 1'] * 201)).encode()
        file = make_uploaded_file(code, filename='medium.py')
        result = handle_file_upload(file, user_is_authenticated=True)
        self.assertIsNotNone(result)

    def test_filename_preserved_in_result(self):
        code = 'def foo():\n    pass\n'
        file = make_uploaded_file(code.encode(), filename='mymodule.py')
        result = handle_file_upload(file, user_is_authenticated=False)
        self.assertEqual(result['filename'], 'mymodule.py')


class DetectLanguageFromFileTests(TestCase):

    def test_python_extension_wins(self):
        lang = _detect_language('fn main() {}', 'app.py')
        self.assertEqual(lang, 'Python')

    def test_typescript_extension_wins(self):
        lang = _detect_language('', 'index.ts')
        self.assertEqual(lang, 'TypeScript')

    def test_no_filename_falls_back_to_content(self):
        code = 'def foo():\n    return 1\n'
        lang = _detect_language(code, '')
        # Pygments should detect Python from content
        self.assertIsInstance(lang, str)
        self.assertGreater(len(lang), 0)
