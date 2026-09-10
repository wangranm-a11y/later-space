from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
STYLES = (ROOT / "styles.css").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


class CanvasRenderStabilityTests(unittest.TestCase):
    def test_canvas_does_not_rebuild_while_pointer_is_active(self):
        viewport = APP[APP.index("function scheduleViewportRender") : APP.index("function imageUrl")]
        self.assertIn("if (state.pointer || state.arrivingIds.size || state.renderFrame) return", viewport)
        self.assertIn('["pan", "marquee"].includes(pointer.mode)', APP)

    def test_unchanged_canvas_markup_keeps_existing_image_nodes(self):
        self.assertIn('worldMarkup: ""', APP)
        self.assertIn("if (worldMarkup !== state.worldMarkup)", APP)
        self.assertIn("state.worldMarkup = worldMarkup", APP)

    def test_dragged_cards_use_composited_transforms(self):
        self.assertIn("translate3d(${record.canvasX}px,${record.canvasY}px,0)", APP)
        self.assertIn(".canvas-item.is-selected { will-change: transform; }", STYLES)
        self.assertIn("backface-visibility: hidden", STYLES)

    def test_static_assets_are_cache_busted(self):
        self.assertIn('styles.css?v=86', INDEX)
        self.assertIn('app.js?v=88', INDEX)


if __name__ == "__main__":
    unittest.main()
