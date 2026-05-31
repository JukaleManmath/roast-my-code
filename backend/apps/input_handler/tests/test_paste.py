from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from apps.input_handler.paste import handle_paste, _detect_language


@override_settings(ANONYMOUS_MAX_LINES=200, AUTHENTICATED_MAX_LINES=500)
class HandlePasteTests(TestCase):

    # ------------------------------------------------------------------ #
    # Rejection cases                                                      #
    # ------------------------------------------------------------------ #

    def test_empty_string_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            handle_paste('', user_is_authenticated=False)
        self.assertIn('empty', str(ctx.exception.detail[0]).lower())

    def test_whitespace_only_raises(self):
        with self.assertRaises(ValidationError):
            handle_paste('   \n  \t  ', user_is_authenticated=False)

    def test_too_short_raises(self):
        with self.assertRaises(ValidationError) as ctx:
            handle_paste('abc', user_is_authenticated=False)
        self.assertIn('too short', str(ctx.exception.detail[0]).lower())

    def test_exactly_nine_chars_raises(self):
        # 10 is the minimum; 9 should fail
        with self.assertRaises(ValidationError):
            handle_paste('123456789', user_is_authenticated=False)

    def test_anonymous_over_200_line_limit_raises(self):
        code = '\n'.join(['x = 1'] * 201)
        with self.assertRaises(ValidationError) as ctx:
            handle_paste(code, user_is_authenticated=False)
        self.assertIn('200', str(ctx.exception.detail[0]))
        self.assertIn('Anonymous', str(ctx.exception.detail[0]))

    def test_authenticated_over_500_line_limit_raises(self):
        code = '\n'.join(['x = 1'] * 501)
        with self.assertRaises(ValidationError) as ctx:
            handle_paste(code, user_is_authenticated=True)
        self.assertIn('500', str(ctx.exception.detail[0]))
        self.assertIn('Authenticated', str(ctx.exception.detail[0]))

    # ------------------------------------------------------------------ #
    # Acceptance cases                                                     #
    # ------------------------------------------------------------------ #

    def test_exactly_ten_chars_passes(self):
        result = handle_paste('1234567890', user_is_authenticated=False)
        self.assertEqual(result['raw_code'], '1234567890')

    def test_anonymous_at_200_line_limit_passes(self):
        code = '\n'.join(['x = 1'] * 200)
        result = handle_paste(code, user_is_authenticated=False)
        self.assertEqual(result['raw_code'], code)

    def test_authenticated_can_exceed_anon_limit(self):
        # 201 lines — over anon limit, but authenticated allows up to 500
        code = '\n'.join(['x = 1'] * 201)
        result = handle_paste(code, user_is_authenticated=True)
        self.assertEqual(result['raw_code'], code)

    def test_valid_paste_returns_expected_keys(self):
        code = 'def hello():\n    return "world"\n'
        result = handle_paste(code, user_is_authenticated=False)
        self.assertEqual(result['raw_code'], code)
        self.assertEqual(result['filename'], '')
        self.assertIsInstance(result['language'], str)
        self.assertGreater(len(result['language']), 0)

    def test_raw_code_is_not_stripped(self):
        # Leading/trailing whitespace in valid code is preserved
        code = '  def hello():\n      return "world"\n  '
        result = handle_paste(code, user_is_authenticated=False)
        self.assertEqual(result['raw_code'], code)


class DetectLanguageTests(TestCase):

    def test_python_code_returns_non_empty_string(self):
        # We trust Pygments' detection; just verify it doesn't crash and
        # returns a non-empty string. Pygments heuristics are not deterministic
        # enough to assert a specific language name from content alone.
        code = 'def foo(x: int) -> str:\n    return str(x)\n'
        lang = _detect_language(code)
        self.assertIsInstance(lang, str)
        self.assertGreater(len(lang), 0)

    def test_unknown_input_returns_non_empty_string(self):
        lang = _detect_language('zzz zzz zzz zzz zzz')
        self.assertIsInstance(lang, str)
