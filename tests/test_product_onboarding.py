from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
STYLES = (ROOT / "styles.css").read_text(encoding="utf-8")


class ProductOnboardingContractTests(unittest.TestCase):
    def test_welcome_is_a_formal_login_page(self):
        self.assertIn('id="welcomeScreen"', INDEX)
        self.assertIn('id="welcomeLoginForm"', INDEX)
        self.assertIn("登录 / 注册", INDEX)
        self.assertIn("先体验 Later Space", INDEX)
        self.assertIn("登录后可在不同设备查看", INDEX)
        self.assertIn("backdrop-filter: blur(8px)", STYLES)
        self.assertIn("background: rgba(249,247,240,.88)", STYLES)
        self.assertNotIn('class="welcome-visual"', INDEX)

    def test_welcome_uses_current_brand_icon(self):
        self.assertIn('<div class="welcome-brand"><img src="assets/favicon.svg?v=2"', INDEX)
        self.assertIn(".welcome-brand img", STYLES)

    def test_welcome_card_is_static_and_dismissible(self):
        self.assertIn('id="closeWelcomeButton"', INDEX)
        self.assertIn('aria-label="关闭登录页面"', INDEX)
        self.assertIn('elements.closeWelcomeButton.addEventListener("click", closeWelcomeScreen)', APP)
        self.assertIn('if (event.target === elements.welcomeScreen) closeWelcomeScreen()', APP)
        self.assertNotIn("function bindWelcomeTilt()", APP)
        self.assertNotIn('perspective(1100px)', STYLES)
        self.assertNotIn('rotateX(var(--tilt-x)) rotateY(var(--tilt-y))', STYLES)

    def test_welcome_form_targets_submit_button(self):
        self.assertIn('querySelector(\'button[type="submit"]\')', APP)
        self.assertIn("登录服务暂时没有准备好，请刷新页面后重试", APP)

    def test_recent_login_email_is_suggested_locally(self):
        self.assertIn('id="welcomeEmailSuggestion"', INDEX)
        self.assertIn('id="welcomeEmailSuggestionValue"', INDEX)
        self.assertIn('autocomplete="email"', INDEX)
        self.assertIn('const LAST_LOGIN_EMAIL_KEY = "later-space-last-login-email-v1"', APP)
        self.assertIn("rememberLoginEmail(email)", APP)
        self.assertIn("chooseWelcomeEmailSuggestion", APP)
        self.assertIn("session?.user?.email", APP)
        self.assertIn(".welcome-email-suggestion { position: static; margin-top: 7px; }", STYLES)

    def test_google_oauth_login_is_available_without_mail_permissions(self):
        self.assertIn('id="welcomeGoogleButton"', INDEX)
        self.assertIn('id="syncGoogleButton"', INDEX)
        self.assertIn('signInWithOAuth({', APP)
        self.assertIn('provider: "google"', APP)
        self.assertIn('redirectTo: cleanAuthRedirectUrl()', APP)
        self.assertIn(".google-login-button", STYLES)

    def test_empty_welcome_reveals_canvas_guides_behind_it(self):
        welcome = APP[APP.index("function showWelcomeScreen") : APP.index("function closeWelcomeScreen")]
        self.assertIn("if (!state.images.length) elements.canvasGuide.hidden = false", welcome)

    def test_canvas_guides_are_interface_only(self):
        self.assertIn('id="canvasGuide"', INDEX)
        self.assertIn("复制喜欢的内容", INDEX)
        self.assertIn("直接粘贴", INDEX)
        self.assertIn("有空再回来", INDEX)
        self.assertIn("showCanvasGuide", APP)
        self.assertNotIn("saveCanvasGuide", APP)
        guide = APP[APP.index("function showCanvasGuide") : APP.index("function finishCanvasGuide")]
        self.assertNotIn("state.images.length", guide)
        render = APP[APP.index("function render()") : APP.index("function mobileRecordTitle")]
        self.assertNotIn("elements.canvasGuide.hidden = true", render)

    def test_account_entry_is_prominent(self):
        self.assertIn('id="accountButton"', INDEX)
        self.assertIn('id="accountAvatar"', INDEX)
        self.assertIn('id="accountName"', INDEX)
        self.assertIn("renderAccountEntry", APP)
        self.assertIn("我的 Later Space", INDEX)
        self.assertIn('id="accountProfile"', INDEX)
        self.assertIn("saveAccountProfile", APP)

    def test_login_does_not_automatically_migrate(self):
        initialize = APP[APP.index("async function initializeCloud") : APP.index("async function requestMagicLink")]
        self.assertNotIn("startGuestMigration", initialize)
        self.assertIn("refreshMigrationOffer", initialize)

    def test_migration_can_be_deferred_and_resumed(self):
        self.assertIn('id="migrationDialog"', INDEX)
        self.assertIn('id="deferMigrationButton"', INDEX)
        self.assertIn('id="accountMigrationButton"', INDEX)
        self.assertIn("deferGuestMigration", APP)
        self.assertIn("migrationEligibleRecords", APP)
        self.assertIn('status: "deferred"', APP)
        self.assertIn("只要本机数据还在", INDEX)

    def test_responsive_account_and_welcome_layouts_exist(self):
        self.assertIn(".welcome-layout", STYLES)
        self.assertIn(".account-button", STYLES)
        self.assertIn(".migration-dialog", STYLES)
        self.assertIn("@media (max-width: 640px)", STYLES)

    def test_magic_link_returns_to_clean_auth_callback(self):
        self.assertIn("cleanAuthRedirectUrl", APP)
        self.assertIn('redirectUrl.search = ""', APP)
        self.assertIn('redirectUrl.hash = ""', APP)
        self.assertIn("saveAuthReturnState", APP)

    def test_auth_callback_finishes_before_welcome_decision(self):
        self.assertIn('id="authReturnScreen"', INDEX)
        self.assertIn("completeCloudAuthReturn", APP)
        init = APP[APP.index("async function init()") : APP.index("init();")]
        self.assertLess(init.index("await initializeCloud()"), init.index("showInitialWelcome()"))
        self.assertIn("closeWelcomeAfterAuthentication", APP)

    def test_cloud_failure_does_not_block_canvas_onboarding(self):
        init = APP[APP.index("async function init()") : APP.index("init();")]
        self.assertIn('console.error("Cloud initialization failed", error)', init)
        self.assertLess(init.index("await initializeCloud()"), init.index("showInitialWelcome()"))
        cloud_error = init[init.index("await initializeCloud()") : init.index("showInitialWelcome()")]
        self.assertIn("catch (error)", cloud_error)

    def test_auth_callback_supports_code_and_legacy_hash(self):
        self.assertIn('searchParams.get("code")', APP)
        self.assertIn('values.get("access_token")', APP)
        self.assertIn("exchangeCodeForSession", APP)
        self.assertIn("clearCloudAuthParameters", APP)
        self.assertIn('"onboarding", "guide"', APP)


if __name__ == "__main__":
    unittest.main()
