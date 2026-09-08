import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
CONFIG = (ROOT / "supabase" / "config.toml").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
FUNCTION_PATH = ROOT / "supabase" / "functions" / "pwa-auth-handoff" / "index.ts"
FUNCTION = FUNCTION_PATH.read_text(encoding="utf-8") if FUNCTION_PATH.exists() else ""


class PwaAuthHandoffContractTest(unittest.TestCase):
    def test_handoff_table_is_private_and_expires(self):
        self.assertIn("create table if not exists public.later_space_pwa_handoffs", SCHEMA)
        self.assertIn("expires_at timestamptz not null", SCHEMA)
        self.assertIn("consumed_at timestamptz", SCHEMA)
        self.assertIn("alter table public.later_space_pwa_handoffs enable row level security", SCHEMA)
        self.assertIn("revoke all on public.later_space_pwa_handoffs from public, anon, authenticated", SCHEMA)

    def test_handoff_consumption_is_atomic_and_service_role_only(self):
        self.assertIn("consume_later_space_pwa_handoff", SCHEMA)
        self.assertIn("consumed_at is null", SCHEMA.lower())
        self.assertIn("expires_at > now()", SCHEMA.lower())
        self.assertIn("returning handoff.auth_token_hash", SCHEMA.lower())
        self.assertIn("grant execute on function public.consume_later_space_pwa_handoff(text) to service_role", SCHEMA)

    def test_edge_function_creates_and_redeems_one_time_credentials(self):
        self.assertIn('action === "create"', FUNCTION)
        self.assertIn('action === "redeem"', FUNCTION)
        self.assertIn("auth.admin.generateLink", FUNCTION)
        self.assertIn("consume_later_space_pwa_handoff", FUNCTION)
        self.assertIn('"Cache-Control": "no-store"', FUNCTION)
        self.assertIn("15 * 60 * 1000", FUNCTION)
        self.assertIn("crypto.subtle.digest", FUNCTION)
        self.assertIn("[functions.pwa-auth-handoff]", CONFIG)
        self.assertIn("verify_jwt = false", CONFIG.split("[functions.pwa-auth-handoff]", 1)[1])

    def test_browser_uses_short_lived_cookie_not_session_tokens(self):
        self.assertIn('const PWA_HANDOFF_COOKIE = "later_space_pwa_handoff"', APP)
        self.assertIn("PWA_HANDOFF_MAX_AGE_SECONDS = 15 * 60", APP)
        self.assertIn("Max-Age=${PWA_HANDOFF_MAX_AGE_SECONDS}", APP)
        self.assertIn("SameSite=Strict", APP)
        self.assertIn("Secure", APP)
        cookie_writer = APP.split("function writePwaHandoffCookie", 1)[1].split("}\n", 1)[0]
        self.assertNotIn("access_token", cookie_writer)
        self.assertNotIn("refresh_token", cookie_writer)

    def test_standalone_redeems_before_cloud_initialization(self):
        self.assertIn("async function redeemPwaAuthHandoff", APP)
        redeem = APP.split("async function redeemPwaAuthHandoff", 1)[1].split("\n}\n", 1)[0]
        self.assertIn("isStandaloneMode()", redeem)
        self.assertIn("verifyOtp", redeem)
        self.assertIn("clearPwaHandoffCookie", redeem)
        init = APP.split("async function init()", 1)[1]
        self.assertLess(init.index("await redeemPwaAuthHandoff()"), init.index("await initializeCloud()"))

    def test_session_refresh_is_scheduled_before_expiry(self):
        self.assertIn("scheduleCloudSessionRefresh", APP)
        self.assertIn("5 * 60 * 1000", APP)
        self.assertIn("ensureFreshCloudSession", APP)
        self.assertIn("登录状态已自动带过来", APP)
        self.assertIn("登录状态没有自动带过来", INDEX)


if __name__ == "__main__":
    unittest.main()
