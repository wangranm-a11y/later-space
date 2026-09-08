from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
STYLES = (ROOT / "styles.css").read_text(encoding="utf-8")


class TextReaderOverlayContractTests(unittest.TestCase):
    def test_reader_is_a_modal_layer_outside_the_canvas_world(self):
        self.assertIn('id="textReaderBackdrop"', INDEX)
        self.assertIn('id="textReaderDialog"', INDEX)
        self.assertIn('role="dialog"', INDEX)
        self.assertIn('aria-modal="true"', INDEX)
        self.assertLess(INDEX.index('id="world"'), INDEX.index('id="textReaderBackdrop"'))
        self.assertIn("position: fixed; inset: 0", STYLES)

    def test_reader_has_an_obvious_persistent_close_action(self):
        self.assertIn('id="textReaderCloseButton"', INDEX)
        self.assertIn('aria-label="收起文字卡片"', INDEX)
        self.assertIn('title="收起"', INDEX)
        self.assertIn('m6 6 8 8M14 6l-8 8', INDEX)
        self.assertIn('elements.textReaderCloseButton.addEventListener("click", closeTextReader)', APP)

    def test_reader_does_not_resize_the_canvas_item(self):
        render = APP[APP.index("function render()") : APP.index("function mobileRecordTitle")]
        self.assertIn("textCard(record)", render)
        self.assertNotIn("is-expanded", render)
        self.assertNotIn("expandedWidth", render)
        self.assertNotIn("expandedHeight", render)

        dimensions = APP[APP.index("function itemHeight") : APP.index("function renderTextReader")]
        self.assertNotIn("expandedTextIds", dimensions)
        self.assertNotIn("EXPANDED_TEXT", dimensions)

    def test_reader_supports_all_expected_close_paths(self):
        self.assertIn("function openTextReader(record)", APP)
        self.assertIn("function closeTextReader()", APP)
        self.assertIn('if (event.target === elements.textReaderBackdrop) closeTextReader()', APP)
        self.assertIn('event.key === "Escape" && state.expandedTextIds.size', APP)
        self.assertIn("openTextReader(record)", APP)
        self.assertIn("closeTextReader()", APP)

    def test_reader_is_readable_and_scrollable(self):
        self.assertIn('id="textReaderBody"', INDEX)
        self.assertIn("overflow: auto", STYLES)
        self.assertIn("line-height: 1.8", STYLES)
        self.assertIn("width: min(680px, calc(100vw - 48px))", STYLES)
        self.assertIn("updateTextReaderScrollCue", APP)
        self.assertIn("can-scroll", STYLES)

    def test_reader_uses_a_fuller_title_than_the_compact_card(self):
        self.assertIn("function readerTextTitle(text)", APP)
        reader = APP[APP.index("function readerTextTitle") : APP.index("function textCard")]
        self.assertIn("characters.length > 64", reader)
        self.assertIn("function readerTextBody(text)", APP)
        self.assertIn("readerTextTitle(record.text)", APP)
        self.assertIn("readerTextBody(record.text)", APP)

    def test_reader_animates_from_and_back_to_the_source_card(self):
        self.assertIn("function animateTextReader", APP)
        self.assertIn("sourceRect", APP)
        self.assertIn("dialog.animate", APP)
        self.assertIn("prefers-reduced-motion", APP)


if __name__ == "__main__":
    unittest.main()
