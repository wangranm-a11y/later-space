from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
MOBILE_INBOX = (ROOT / "supabase" / "functions" / "mobile-inbox" / "index.ts").read_text(encoding="utf-8")
FUNCTION_CONFIG = (ROOT / "supabase" / "config.toml").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


class CloudSchemaContractTests(unittest.TestCase):
    def test_cloud_tables_are_user_scoped_and_rls_enabled(self):
        for table in ("later_space_items", "later_space_capture_tokens", "later_space_usage"):
            self.assertIn(f"public.{table}", SCHEMA)
            self.assertRegex(SCHEMA, rf"alter table public\.{table} enable row level security")
        self.assertIn("auth.uid() = user_id", SCHEMA)

    def test_capacity_defaults_and_thresholds_match_product_rules(self):
        self.assertIn("default 52428800", SCHEMA)  # 50 MB per account
        self.assertIn("default 1073741824", SCHEMA)  # 1 GB shared project
        self.assertIn("default 0.700", SCHEMA)
        self.assertIn("default 0.800", SCHEMA)
        self.assertIn("default 0.850", SCHEMA)
        self.assertIn("next_user_bytes > user_limit", SCHEMA)
        self.assertIn("next_system_bytes > system_limit", SCHEMA)

    def test_capacity_mutation_is_service_role_only_and_serialized(self):
        self.assertIn("pg_advisory_xact_lock", SCHEMA)
        self.assertIn("reserve_later_space_storage", SCHEMA)
        self.assertIn("release_later_space_storage", SCHEMA)
        self.assertRegex(
            SCHEMA,
            r"revoke all on function public\.reserve_later_space_storage\(uuid, bigint\) from public, anon, authenticated",
        )
        self.assertRegex(
            SCHEMA,
            r"grant execute on function public\.reserve_later_space_storage\(uuid, bigint\) to service_role",
        )

    def test_media_bucket_only_allows_optimized_files(self):
        self.assertIn("false, 5242880", SCHEMA)
        self.assertNotIn('create policy "Users upload own Later Space media"', SCHEMA)
        self.assertIn('create policy "Users read own Later Space media"', SCHEMA)


class MobileInboxContractTests(unittest.TestCase):
    def test_function_validates_its_own_capture_token(self):
        self.assertIn("later_space_capture_tokens", MOBILE_INBOX)
        self.assertIn("sha256Hex(captureToken)", MOBILE_INBOX)
        self.assertIn(".is(\"revoked_at\", null)", MOBILE_INBOX)
        self.assertIn("verify_jwt = false", FUNCTION_CONFIG)

    def test_function_only_accepts_v1_content_types(self):
        self.assertIn('type CaptureKind = "image" | "link" | "text"', MOBILE_INBOX)
        self.assertIn('"image/jpeg", "image/png", "image/webp"', MOBILE_INBOX)
        self.assertNotIn('CaptureKind = "video"', MOBILE_INBOX)

    def test_success_is_returned_only_after_storage_and_row_write(self):
        upload_at = MOBILE_INBOX.index(".upload(assetPath")
        insert_at = MOBILE_INBOX.index('.from("later_space_items").insert')
        success_at = MOBILE_INBOX.index('textResponse("已收进 Later Space"')
        self.assertLess(upload_at, insert_at)
        self.assertLess(insert_at, success_at)

    def test_image_failures_release_reserved_capacity(self):
        catch_body = MOBILE_INBOX[MOBILE_INBOX.index("} catch (error)") :]
        self.assertIn("remove([uploadedPath])", catch_body)
        self.assertIn("release_later_space_storage", catch_body)

    def test_user_facing_capacity_errors_are_explicit(self):
        self.assertIn("你的图片空间已满，请先在 Later Space 删除一些图片", MOBILE_INBOX)
        self.assertIn("Later Space 图片空间暂时已满，仍可收藏文字和链接", MOBILE_INBOX)
        self.assertNotRegex(MOBILE_INBOX, re.compile(r'fixed success|always success', re.I))


class WebCloudContractTests(unittest.TestCase):
    def test_guest_and_user_workspaces_are_separate(self):
        self.assertIn('id = `guest:${makeId()}`', APP)
        self.assertIn('return `user:${userId}`', APP)
        self.assertIn('workspaceId: activeWorkspaceId()', APP)
        self.assertIn('await clearWorkspace(userWorkspaceId(user.id))', APP)
        self.assertIn('await switchWorkspace(guestWorkspaceId())', APP)

    def test_first_login_migration_is_opt_in_deferred_and_reversible(self):
        self.assertIn("startGuestMigration", APP)
        self.assertIn("finalizePendingMigration", APP)
        self.assertIn("undoGuestMigration", APP)
        self.assertIn("deferGuestMigration", APP)
        initialize = APP[APP.index("async function initializeCloud") : APP.index("async function requestMagicLink")]
        self.assertNotIn("startGuestMigration", initialize)
        self.assertIn('"取消"', APP)
        self.assertIn('"撤销"', APP)

    def test_images_are_optimized_and_capacity_block_is_image_only(self):
        self.assertIn("optimizeImageFile", APP)
        self.assertIn("maximumSide = 1920", APP)
        self.assertIn("cloudUsageRatio() >= .85", APP)
        self.assertIn("文字和链接仍可收藏", APP)
        self.assertIn('accept="image/*"', INDEX)

    def test_cloud_upload_uses_capacity_checked_edge_function(self):
        self.assertIn('/functions/v1/mobile-inbox', APP)
        self.assertIn('mode: "asset"', APP)
        self.assertIn('mode: "discard"', APP)
        self.assertNotIn('/storage/v1/object/later-space-media/${path}', APP)

    def test_realtime_has_focus_and_polling_fallbacks(self):
        self.assertIn('postgres_changes', APP)
        self.assertIn('window.setInterval(() => syncCloud(), 30000)', APP)
        self.assertIn('window.addEventListener("focus", () => syncCloud())', APP)

    def test_mobile_capture_token_can_be_created_copied_and_revoked(self):
        self.assertIn("createCaptureToken", APP)
        self.assertIn("copyPersonalCaptureUrl", APP)
        self.assertIn("stopCaptureToken", APP)
        self.assertIn('id="copyCaptureUrlButton"', INDEX)


if __name__ == "__main__":
    unittest.main()
