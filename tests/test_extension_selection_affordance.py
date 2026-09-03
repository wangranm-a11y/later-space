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
        self.assertIn('"version": "1.9.2"', MANIFEST)

    def test_selection_button_uses_centered_moss_plus(self):
        self.assertIn('function selectionMark()', FEEDBACK)
        self.assertIn('left:1px;top:6px;width:12px;height:2px', FEEDBACK)
        self.assertIn('left:6px;top:1px;width:2px;height:12px', FEEDBACK)
        self.assertIn('width:28px;height:28px', FEEDBACK)
        self.assertIn('border-radius:50%', FEEDBACK)
        self.assertIn('background:#fff', FEEDBACK)
        self.assertIn('background:#718e64', FEEDBACK)
        self.assertIn('style.setProperty("background"', FEEDBACK)
        self.assertIn('"important"', FEEDBACK)

    def test_selection_button_changes_to_check_before_removal(self):
        self.assertIn('setSelectionButtonSaved(selectionButton);', FEEDBACK)
        self.assertIn('mark.textContent = "✓"', FEEDBACK)
        self.assertIn('setTimeout(resolve, 700)', FEEDBACK)

    def test_feedback_view_arrow_uses_centered_svg(self):
        self.assertIn('view.innerHTML = \'<svg viewBox="0 0 20 20"', FEEDBACK)
        self.assertIn('display:grid;place-items:center', FEEDBACK)


if __name__ == "__main__":
    unittest.main()
