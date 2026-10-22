import unittest

from scripts.check_python_coverage import coverage_percent, meets_threshold


class VerifyGateTests(unittest.TestCase):
    def test_coverage_percentage_handles_empty_and_partial_scopes(self):
        self.assertEqual(coverage_percent(0, 0), 100.0)
        self.assertEqual(coverage_percent(8, 10), 80.0)

    def test_coverage_threshold_rejects_a_regression(self):
        self.assertTrue(meets_threshold(80.0))
        self.assertFalse(meets_threshold(79.99))


if __name__ == "__main__":
    unittest.main()
