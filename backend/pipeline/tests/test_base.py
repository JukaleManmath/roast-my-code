import json
from unittest.mock import MagicMock, patch

from django.test import TestCase

from pipeline.agents.base import _error_verdict, _parse_verdict, call_agent


def _sample_verdict() -> dict:
    return {
        'issues': [
            {
                'title': 'Missing error handling',
                'description': 'No try/except around DB call.',
                'severity': 'warning',
                'line_hint': '42',
            }
        ],
        'summary': 'Mostly fine, one concern.',
        'overall_severity': 'warning',
    }


def _sample_state() -> dict:
    return {
        'review_id': 'test-review-id-123',
        'raw_code': 'def hello():\n    return "world"\n',
        'language': 'Python',
        'filename': 'hello.py',
    }


class ParseVerdictTests(TestCase):

    def test_clean_json_is_parsed(self):
        content = json.dumps(_sample_verdict())
        result = _parse_verdict('pragmatist', content)
        self.assertEqual(result['summary'], 'Mostly fine, one concern.')
        self.assertEqual(len(result['issues']), 1)

    def test_json_inside_backtick_json_fence_is_parsed(self):
        inner = json.dumps(_sample_verdict())
        content = f'```json\n{inner}\n```'
        result = _parse_verdict('pragmatist', content)
        self.assertEqual(result['overall_severity'], 'warning')

    def test_json_inside_plain_backtick_fence_is_parsed(self):
        inner = json.dumps(_sample_verdict())
        content = f'```\n{inner}\n```'
        result = _parse_verdict('pragmatist', content)
        self.assertEqual(result['summary'], 'Mostly fine, one concern.')

    def test_invalid_json_returns_error_verdict(self):
        result = _parse_verdict('pragmatist', 'not valid json {{ oops')
        self.assertEqual(result['issues'][0]['title'], 'Agent Error')
        self.assertIn('JSON', result['issues'][0]['description'])

    def test_empty_string_returns_error_verdict(self):
        result = _parse_verdict('pragmatist', '')
        self.assertEqual(result['issues'][0]['title'], 'Agent Error')


class ErrorVerdictTests(TestCase):

    def test_error_verdict_has_required_keys(self):
        result = _error_verdict('Something went wrong')
        self.assertIn('issues', result)
        self.assertIn('summary', result)
        self.assertIn('overall_severity', result)

    def test_error_verdict_severity_is_warning(self):
        result = _error_verdict('oops')
        self.assertEqual(result['overall_severity'], 'warning')

    def test_error_verdict_issue_title_is_agent_error(self):
        result = _error_verdict('some message')
        self.assertEqual(result['issues'][0]['title'], 'Agent Error')

    def test_error_message_appears_in_description(self):
        result = _error_verdict('Pipeline timeout')
        self.assertIn('Pipeline timeout', result['issues'][0]['description'])


class CallAgentTests(TestCase):

    @patch('pipeline.agents.base._broadcast_agent_done')
    @patch('pipeline.agents.base.Groq')
    def test_successful_response_returns_named_verdict(self, MockGroq, mock_broadcast):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(_sample_verdict())
        mock_response.choices[0].finish_reason = 'stop'
        MockGroq.return_value.chat.completions.create.return_value = mock_response

        result = call_agent('pragmatist', 'You are pragmatist.', _sample_state())

        self.assertIn('pragmatist', result)
        self.assertEqual(result['pragmatist']['summary'], 'Mostly fine, one concern.')

    @patch('pipeline.agents.base._broadcast_agent_done')
    @patch('pipeline.agents.base.Groq')
    def test_truncated_response_adds_note_to_summary(self, MockGroq, mock_broadcast):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(_sample_verdict())
        mock_response.choices[0].finish_reason = 'length'
        MockGroq.return_value.chat.completions.create.return_value = mock_response

        result = call_agent('pragmatist', 'prompt', _sample_state())

        self.assertIn('truncated', result['pragmatist']['summary'].lower())

    @patch('pipeline.agents.base._broadcast_agent_done')
    @patch('pipeline.agents.base.Groq')
    def test_groq_exception_returns_error_verdict(self, MockGroq, mock_broadcast):
        MockGroq.return_value.chat.completions.create.side_effect = Exception('API down')

        result = call_agent('pragmatist', 'prompt', _sample_state())

        self.assertIn('pragmatist', result)
        self.assertEqual(result['pragmatist']['issues'][0]['title'], 'Agent Error')

    @patch('pipeline.agents.base._broadcast_agent_done')
    @patch('pipeline.agents.base.Groq')
    def test_broadcast_called_even_on_exception(self, MockGroq, mock_broadcast):
        MockGroq.return_value.chat.completions.create.side_effect = Exception('boom')

        call_agent('paranoid', 'prompt', _sample_state())

        mock_broadcast.assert_called_once()
        args = mock_broadcast.call_args[0]
        self.assertEqual(args[0], 'test-review-id-123')
        self.assertEqual(args[1], 'paranoid')

    @patch('pipeline.agents.base._broadcast_agent_done')
    @patch('pipeline.agents.base.Groq')
    def test_broadcast_called_with_verdict_on_success(self, MockGroq, mock_broadcast):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(_sample_verdict())
        mock_response.choices[0].finish_reason = 'stop'
        MockGroq.return_value.chat.completions.create.return_value = mock_response

        call_agent('minimalist', 'prompt', _sample_state())

        mock_broadcast.assert_called_once_with(
            'test-review-id-123', 'minimalist', mock_broadcast.call_args[0][2]
        )
