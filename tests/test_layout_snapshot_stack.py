from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
STYLES = (ROOT / "styles.css").read_text(encoding="utf-8")
README = (ROOT / "README.md").read_text(encoding="utf-8")


class LayoutSnapshotStackTests(unittest.TestCase):
    def test_keeps_a_ten_deep_snapshot_stack(self):
        self.assertIn("const LAYOUT_SNAPSHOT_LIMIT = 10", APP)
        self.assertIn("later-space-layout-snapshots-v1", APP)
        self.assertIn("state.layoutSnapshots.length - LAYOUT_SNAPSHOT_LIMIT", APP)
        self.assertNotIn("layoutSnapshot: null", APP)
        self.assertNotIn("if (state.layoutSnapshot) return restoreCanvas()", APP)

    def test_tidy_and_heart_share_apply_canvas_layout_hook(self):
        self.assertIn("async function applyCanvasLayout(mutator", APP)
        apply = APP[APP.index("async function applyCanvasLayout") : APP.index("function layoutRecordsTidy")]
        self.assertIn("flushDragLayoutSnapshot()", apply)
        self.assertIn('pushLayoutSnapshot({ label: snapshotLabel || "整理前" })', apply)
        self.assertLess(apply.index("flushDragLayoutSnapshot()"), apply.index("pushLayoutSnapshot({ label: snapshotLabel"))
        self.assertIn("await applyCanvasLayout(layoutRecordsTidy", APP)
        self.assertIn('snapshotLabel: "整齐前"', APP)
        self.assertIn("await applyCanvasLayout(layoutRecordsHeart", APP)
        self.assertIn('snapshotLabel: "心形前"', APP)
        self.assertIn("function layoutRecordsHeart(records)", APP)

    def test_drag_writes_one_debounced_snapshot_after_pause(self):
        self.assertIn("const LAYOUT_DRAG_SNAPSHOT_DELAY_MS = 2000", APP)
        self.assertIn("function scheduleDragLayoutSnapshot()", APP)
        self.assertIn("LAYOUT_DRAG_SNAPSHOT_DELAY_MS", APP[APP.index("function scheduleDragLayoutSnapshot()") :])
        self.assertIn('pushLayoutSnapshot({ items: state.layoutDragBaseline, label: "拖动前" })', APP)
        self.assertIn('["item", "resize"].includes(pointer.mode) && pointer.moved) scheduleDragLayoutSnapshot()', APP)
        move = APP[APP.index("function movePointer") : APP.index("function endPointer")]
        self.assertNotIn("pushLayoutSnapshot", move)
        self.assertNotIn("scheduleDragLayoutSnapshot", move)

    def test_restore_last_second_last_and_history_picker(self):
        self.assertIn("恢复上次", INDEX)
        self.assertIn("恢复上上次", INDEX)
        self.assertIn('data-layout-action="restore-last"', INDEX)
        self.assertIn('data-layout-action="restore-previous"', INDEX)
        self.assertIn('id="organizeHistory"', INDEX)
        restore = APP[APP.index("async function restoreLayoutFromStack") : APP.index("async function restoreLayoutById")]
        self.assertIn("selectableLayoutSnapshots()", restore)
        self.assertIn("restoreLayoutFromStack(0, ", APP)
        self.assertIn("restoreLayoutFromStack(1, ", APP)
        self.assertIn("function restoreLayoutById(snapshotId)", APP)
        self.assertIn("data-layout-restore", APP)

    def test_organize_menu_lists_tidy_heart_and_scatter_placeholder(self):
        self.assertIn('data-layout-action="tidy"', INDEX)
        self.assertIn(">整齐<", INDEX)
        self.assertIn('data-layout-action="heart"', INDEX)
        self.assertIn(">心形<", INDEX)
        self.assertIn('data-layout-action="scatter"', INDEX)
        self.assertIn("即将推出", INDEX)
        self.assertIn('id="organizePanel"', INDEX)
        self.assertIn("function toggleOrganizeMenu()", APP)
        self.assertIn(".organize-panel", STYLES)
        self.assertNotIn("is-organized", STYLES)
        self.assertNotIn("restore-icon", INDEX)

    def test_migrates_legacy_single_snapshot(self):
        self.assertIn("const LEGACY_LAYOUT_SNAPSHOT_KEY", APP)
        self.assertIn("function normalizeLayoutSnapshots(raw)", APP)
        self.assertIn("legacy-layout", APP)
        self.assertIn("localStorage.removeItem(LEGACY_LAYOUT_SNAPSHOT_KEY)", APP)

    def test_readme_describes_the_restore_stack(self):
        self.assertIn("最多保留 10 份", README)
        self.assertIn("恢复上次", README)
        self.assertIn("2 秒", README)


if __name__ == "__main__":
    unittest.main()
