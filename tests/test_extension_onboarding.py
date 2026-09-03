from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / "extensions" / "later-space"
MANIFEST = (EXTENSION / "manifest.json").read_text(encoding="utf-8")
WORKER = (EXTENSION / "service-worker.js").read_text(encoding="utf-8")
FEEDBACK = (EXTENSION / "page-feedback.js").read_text(encoding="utf-8")
POPUP = (EXTENSION / "popup.html").read_text(encoding="utf-8")
OPTIONS = (EXTENSION / "options.html").read_text(encoding="utf-8")
WELCOME_CSS = (EXTENSION / "selection-affordance.css").read_text(encoding="utf-8")
WELCOME_JS = (EXTENSION / "welcome.js").read_text(encoding="utf-8")


class ExtensionOnboardingContractTests(unittest.TestCase):
    def test_first_install_opens_welcome_but_updates_do_not(self):
        self.assertIn('details.reason === "install"', WORKER)
        self.assertIn('chrome.runtime.getURL("welcome.html")', WORKER)
        self.assertNotIn('details.reason === "update"', WORKER)

    def test_onboarding_state_and_cleanup_have_runtime_messages(self):
        for message_type in (
            "onboarding-status",
            "onboarding-progress",
            "onboarding-capture",
            "onboarding-cleanup",
        ):
            self.assertIn(f'"{message_type}"', WORKER)
        self.assertIn("ONBOARDING_STATE_KEY", WORKER)
        self.assertIn("onboardingSessionId", WORKER)

    def test_sound_is_shared_and_only_success_states_play(self):
        sound = (EXTENSION / "feedback-sound.js").read_text(encoding="utf-8")
        self.assertIn("laterSpaceSoundEnabled", sound)
        self.assertIn('state === "saved" || state === "duplicate"', sound)
        self.assertIn("playLaterSpaceSuccessSound", sound)
        self.assertIn('"feedback-sound.js", "page-feedback.js"', MANIFEST)

    def test_floating_icon_has_hover_and_pressed_states(self):
        self.assertIn('setSelectionButtonHover(button, true)', FEEDBACK)
        self.assertIn('setSelectionButtonHover(button, false)', FEEDBACK)
        self.assertIn('button.style.transform = "translateY(-1px) scale(.96)"', FEEDBACK)
        self.assertNotIn("backdrop-filter", FEEDBACK)

    def test_reload_refreshes_feedback_script_in_open_web_tabs(self):
        self.assertIn("async function refreshOpenWebTabs()", WORKER)
        self.assertIn('chrome.tabs.query({ url: ["http://*/*", "https://*/*"] })', WORKER)
        self.assertIn('files: ["feedback-sound.js", "page-feedback.js"]', WORKER)
        self.assertIn("refreshOpenWebTabs();", WORKER)
        self.assertIn("chrome.runtime.onStartup.addListener", WORKER)

    def test_welcome_files_and_user_entry_points_exist(self):
        for name in ("welcome.html", "welcome.css", "welcome.js", "feedback-sound.js", "selection-affordance.css"):
            self.assertTrue((EXTENSION / name).is_file(), name)
        self.assertIn("使用指南", POPUP)
        self.assertIn("设置", POPUP)
        self.assertIn("收藏提示音", OPTIONS)
        self.assertIn("重新查看使用指南", OPTIONS)

    def test_welcome_selection_button_matches_current_affordance(self):
        self.assertIn("selection-capture-v2", WELCOME_JS)
        self.assertIn("selection-plus", WELCOME_JS)
        self.assertIn("width: 28px", WELCOME_CSS)
        self.assertIn("#718e64", WELCOME_CSS)

    def test_release_version_is_1_9_3(self):
        self.assertIn('"version": "1.9.3"', MANIFEST)


if __name__ == "__main__":
    unittest.main()
