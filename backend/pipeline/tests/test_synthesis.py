import json
from unittest.mock import MagicMock, patch

from django.test import TestCase

from pipeline.agents.synthesis import _error_synthesis, _parse_synthesis, synthesis_node


def _sample_synthesis() -> dict:
    return {
        'critical': [
            {'title': 'SQL Injection', 'description': 'Raw query', 'agents': ['paranoid', 'pragmatist']}
        ],
        'warnings': [
            {'title': 'No logging', 'description': 'Errors are swallowed', 'agents': ['pragmatist']}
        ],
        'suggestions': [],
        'conflicts': [],
        'overall_score': 65,
        'summary': 'Several serious issues need attention.',
    }


class ParseSynthesisTests(TestCase):

    def test_clean_json_is_parsed(self):
        content = json.dumps(_sample_synthesis())
        result = _parse_synthesis(content)
        self.assertEqual(result['overall_score'], 65)
        self.assertEqual(result['summary'], 'Several serious issues need attention.')
        self.assertEqual(len(result['critical']), 1)

    def test_json_inside_backtick_fence_is_parsed(self):
        inner = json.dumps(_sample_synthesis())
        content = f'```json\n{inner}\n```'
        result = _parse_synthesis(content)
        self.assertEqual(result['overall_score'], 65)

    def test_json_inside_plain_fence_is_parsed(self):
        inner = json.dumps(_sample_synthesis())
        content = f'```\n{inner}\n```'
        result = _parse_synthesis(content)
        self.assertEqual(len(result['critical']), 1)

    def test_invalid_json_returns_error_synthesis(self):
        result = _parse_synthesis('{this is not json}')
        self.assertEqual(result['critical'], [])
        self.assertEqual(result['overall_score'], 0)
        self.assertIn('Synthesis Error', result['warnings'][0]['title'])

    def test_empty_string_returns_error_synthesis(self):
        result = _parse_synthesis('')
        self.assertEqual(result['overall_score'], 0)


class ErrorSynthesisTests(TestCase):

    def test_error_synthesis_has_required_keys(self):
        result = _error_synthesis('LLM failed')
        self.assertIn('critical', result)
        self.assertIn('warnings', result)
        self.assertIn('suggestions', result)
        self.assertIn('conflicts', result)
        self.assertIn('overall_score', result)
        self.assertIn('summary', result)

    def test_error_synthesis_score_is_zero(self):
        result = _error_synthesis('timeout')
        self.assertEqual(result['overall_score'], 0)

    def test_error_synthesis_critical_and_suggestions_empty(self):
        result = _error_synthesis('timeout')
        self.assertEqual(result['critical'], [])
        self.assertEqual(result['suggestions'], [])
        self.assertEqual(result['conflicts'], [])

    def test_error_message_appears_in_warning(self):
        result = _error_synthesis('API rate limit')
        self.assertIn('API rate limit', result['warnings'][0]['description'])

    def test_error_message_appears_in_summary(self):
        result = _error_synthesis('network timeout')
        self.assertIn('network timeout', result['summary'])


class SynthesisNodeTests(TestCase):

    def _make_state(self) -> dict:
        agent_review = {
            'issues': [{'title': 'Issue', 'description': 'desc', 'severity': 'warning', 'line_hint': ''}],
            'summary': 'some issues',
            'overall_severity': 'warning',
        }
        return {
            'review_id': 'test-id-999',
            'raw_code': 'def foo(): pass',
            'language': 'Python',
            'filename': 'foo.py',
            'pragmatist': agent_review,
            'paranoid': agent_review,
            'minimalist': agent_review,
            'optimizer': agent_review,
            'mentor': agent_review,
        }

    @patch('pipeline.agents.synthesis._broadcast_synthesis_done')
    @patch('pipeline.agents.synthesis.Groq')
    def test_synthesis_node_returns_synthesis_key(self, MockGroq, mock_broadcast):
        mock_response = MagicMock()
        mock_response.choices[0].message.content = json.dumps(_sample_synthesis())
        MockGroq.return_value.chat.completions.create.return_value = mock_response

        result = synthesis_node(self._make_state())

        self.assertIn('synthesis', result)
        self.assertEqual(result['synthesis']['overall_score'], 65)

    @patch('pipeline.agents.synthesis._broadcast_synthesis_done')
    @patch('pipeline.agents.synthesis.Groq')
    def test_groq_exception_returns_error_synthesis(self, MockGroq, mock_broadcast):
        MockGroq.return_value.chat.completions.create.side_effect = Exception('API down')

        result = synthesis_node(self._make_state())

        self.assertIn('synthesis', result)
        self.assertEqual(result['synthesis']['overall_score'], 0)

    @patch('pipeline.agents.synthesis._broadcast_synthesis_done')
    @patch('pipeline.agents.synthesis.Groq')
    def test_broadcast_always_called(self, MockGroq, mock_broadcast):
        MockGroq.return_value.chat.completions.create.side_effect = Exception('boom')

        synthesis_node(self._make_state())

        mock_broadcast.assert_called_once()
