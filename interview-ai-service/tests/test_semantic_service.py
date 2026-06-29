import sys
import unittest
import unittest.mock
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

# Set the environment flags BEFORE importing the module
import os
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["TRANSFORMERS_NO_FLAX"] = "1"

# Mock the entire sentence_transformers module so import succeeds
mock_st_module = unittest.mock.MagicMock()
mock_model_instance = unittest.mock.MagicMock()
mock_st_module.SentenceTransformer.return_value = mock_model_instance
mock_st_module.util = unittest.mock.MagicMock()

sys.modules["sentence_transformers"] = mock_st_module

from services.semantic_service import compute_similarity, compute_technical_score


class ComputeSimilarityTests(unittest.TestCase):
    def test_returns_zero_when_transcript_is_empty(self):
        result = compute_similarity("", "expected answer")
        self.assertEqual(result, 0.0)

    def test_returns_zero_when_transcript_is_whitespace(self):
        result = compute_similarity("   \n\t  ", "expected answer")
        self.assertEqual(result, 0.0)

    def test_returns_zero_when_expected_answer_is_empty(self):
        result = compute_similarity("student answer", "")
        self.assertEqual(result, 0.0)

    def test_returns_zero_when_both_are_empty(self):
        result = compute_similarity("", "")
        self.assertEqual(result, 0.0)

    def test_returns_zero_when_both_are_whitespace(self):
        result = compute_similarity("  ", "  ")
        self.assertEqual(result, 0.0)

    def test_returns_075_similarity_for_matching_answers(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.75)
        mock_st_module.util.cos_sim.reset_mock()
        result = compute_similarity("student answer here", "expected answer here")
        self.assertAlmostEqual(result, 0.75, places=2)
        mock_st_module.util.cos_sim.assert_called_once()

    def test_clamps_negative_cosine_to_zero(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: -0.3)
        result = compute_similarity("answer a", "answer b")
        self.assertEqual(result, 0.0)

    def test_clamps_cosine_above_one_to_one(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 1.2)
        result = compute_similarity("answer a", "answer b")
        self.assertEqual(result, 1.0)


class ComputeTechnicalScoreTests(unittest.TestCase):
    def test_returns_zero_for_empty_inputs(self):
        score = compute_technical_score("", "")
        self.assertEqual(score, 0)

    def test_returns_zero_for_whitespace_inputs(self):
        score = compute_technical_score("  ", "  ")
        self.assertEqual(score, 0)

    def test_score_at_zero_similarity(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.0)
        score = compute_technical_score("transcript", "expected")
        self.assertEqual(score, 0)

    def test_score_at_ten_percent_similarity(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.1)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 10)

    def test_score_at_30_percent_similarity_boundary(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.3)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 30)

    def test_score_at_59_percent_similarity(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.59)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 59)

    def test_score_at_60_percent_similarity_boundary(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.6)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 60)

    def test_score_at_79_percent_similarity(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.79)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 84)

    def test_score_at_80_percent_similarity_boundary(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.8)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 85)

    def test_score_at_90_percent_similarity(self):
        # Note: floating-point rounding may shift result by 1 at boundaries
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.9)
        score = compute_technical_score("a", "b")
        self.assertIn(score, [92, 93])

    def test_score_at_100_percent_similarity(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 1.0)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, 100)

    def test_score_is_always_an_integer(self):
        mock_st_module.util.cos_sim.return_value = unittest.mock.MagicMock(item=lambda: 0.55)
        score = compute_technical_score("a", "b")
        self.assertEqual(score, int(score))


if __name__ == "__main__":
    unittest.main()
