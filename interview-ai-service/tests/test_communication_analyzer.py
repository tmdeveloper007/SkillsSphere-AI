import sys
import unittest
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))

from services.communication_analyzer import (  # noqa: E402
    analyze_communication,
    FILLER_WORDS,
)


class CommunicationAnalyzerTests(unittest.TestCase):
    def test_empty_transcript_returns_zero_score(self):
        """Empty transcript should return zero communication score."""
        result = analyze_communication("")
        self.assertEqual(result["communication"], 0)
        self.assertEqual(result["fillerWords"], 0)
        self.assertEqual(result["speakingSpeed"], "normal")
        self.assertEqual(result["details"]["wordCount"], 0)

    def test_whitespace_only_returns_zero_score(self):
        """Whitespace-only input should be treated as empty."""
        result = analyze_communication("   \n\t  ")
        self.assertEqual(result["communication"], 0)
        self.assertEqual(result["fillerWords"], 0)

    def test_filler_word_detection(self):
        """Filler words should be counted correctly."""
        result = analyze_communication(
            "Um, I think, like, you know, basically, I mean, sort of, right."
        )
        self.assertGreaterEqual(result["fillerWords"], 7)
        self.assertLess(result["communication"], 100)

    def test_filler_word_case_insensitive(self):
        """Filler word detection should be case-insensitive."""
        result_lower = analyze_communication("um like")
        result_upper = analyze_communication("UM LIKE")
        result_mixed = analyze_communication("Um LiKe")
        self.assertEqual(
            result_lower["fillerWords"],
            result_upper["fillerWords"],
        )
        self.assertEqual(
            result_upper["fillerWords"],
            result_mixed["fillerWords"],
        )

    def test_speaking_speed_slow(self):
        """Word count under 20 should be classified as slow."""
        result = analyze_communication("This is a short answer.")
        self.assertEqual(result["speakingSpeed"], "slow")
        self.assertLess(result["details"]["wordCount"], 20)

    def test_speaking_speed_fast(self):
        """Word count over 200 should be classified as fast."""
        long_text = " ".join(["a b c d e f g h i j k l"] * 20)
        result = analyze_communication(long_text)
        self.assertGreater(result["details"]["wordCount"], 200)
        self.assertEqual(result["speakingSpeed"], "fast")

    def test_speaking_speed_normal(self):
        """Word count between 20 and 200 should be normal."""
        normal_text = " ".join(["good response with reasonable length"] * 15)
        result = analyze_communication(normal_text)
        self.assertEqual(result["speakingSpeed"], "normal")
        self.assertGreater(result["details"]["wordCount"], 20)
        self.assertLessEqual(result["details"]["wordCount"], 200)

    def test_sentence_counting(self):
        """Sentence splitting should work correctly."""
        result = analyze_communication(
            "First sentence. Second sentence! Third question?"
        )
        self.assertEqual(result["details"]["sentenceCount"], 3)

    def test_avg_sentence_length_calculation(self):
        """Average sentence length is computed correctly."""
        result = analyze_communication("One two three four. Five six seven eight nine.")
        self.assertEqual(result["details"]["avgSentenceLength"], 4.5)

    def test_good_answer_scores_reasonable(self):
        """Well-structured answer should score reasonably."""
        text = (
            "Led the engineering team to successfully deliver the "
            "mission-critical platform on schedule and within budget."
        )
        result = analyze_communication(text)
        self.assertGreaterEqual(result["communication"], 50)

    def test_filler_words_reduce_score(self):
        """Filler words should reduce the communication score."""
        clean = "Led the team to success. Excellent result."
        with_fillers = "Um, led the team to success. Uh, excellent result."
        score_clean = analyze_communication(clean)["communication"]
        score_filled = analyze_communication(with_fillers)["communication"]
        self.assertLess(score_filled, score_clean)

    def test_score_never_exceeds_100(self):
        """Score should be clamped to a maximum of 100."""
        text = "Built the feature. Developed the API. Optimized the database. Led the team. Delivered the project."
        result = analyze_communication(text)
        self.assertLessEqual(result["communication"], 100)

    def test_score_never_below_0(self):
        """Score should be clamped to a minimum of 0."""
        text = "um " * 50
        result = analyze_communication(text)
        self.assertGreaterEqual(result["communication"], 0)

    def test_multi_word_filler_phrases_detected(self):
        """Multi-word filler phrases should be detected."""
        result = analyze_communication(
            "I you know think that this is right okay so basically."
        )
        self.assertGreaterEqual(result["fillerWords"], 4)

    def test_filler_words_constant_populated(self):
        """FILLER_WORDS should contain expected entries."""
        self.assertGreater(len(FILLER_WORDS), 0)
        self.assertIn("um", FILLER_WORDS)
        self.assertIn("uh", FILLER_WORDS)
        self.assertIn("like", FILLER_WORDS)
        self.assertIn("basically", FILLER_WORDS)

    def test_single_word_sentence(self):
        """Single word should have correct metrics."""
        result = analyze_communication("Hello.")
        self.assertEqual(result["details"]["wordCount"], 1)
        self.assertEqual(result["details"]["sentenceCount"], 1)
        self.assertEqual(result["speakingSpeed"], "slow")


if __name__ == "__main__":
    unittest.main()
