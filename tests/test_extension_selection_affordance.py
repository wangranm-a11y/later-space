from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
FEEDBACK = (ROOT / "extensions" / "later-space" / "page-feedback.js").read_text(encoding="utf-8")
MANIFEST = (ROOT / "extensions" / "later-space" / "manifest.json").read_text(encoding="utf-8")


class ExtensionSelectionAffordanceTests(unittest.TestCase):
    def test_selection_icon_uses_last_visible_line(self):
        self.assertIn("getClientRects()", FEEDBACK)
        self.assertIn("lastVisibleSelectionRect", FEEDBACK)

    def test_selection_icon_appears_ten_ms_after_selection_finishes(self):
        self.assertIn("const SELECTION_BUTTON_DELAY_MS = 10", FEEDBACK)
        self.assertIn("}, SELECTION_BUTTON_DELAY_MS);", FEEDBACK)

    def test_extension_version_is_bumped(self):
        self.assertIn('"version": "1.9.0"', MANIFEST)


if __name__ == "__main__":
    unittest.main()
