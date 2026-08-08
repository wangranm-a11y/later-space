import json
import threading
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class BackupRecoveryTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = TemporaryDirectory()
        self.previous_backup_dir = server.BACKUP_DIR
        self.previous_inbox_path = server.INBOX_PATH
        self.previous_sync_status_path = server.SYNC_STATUS_PATH
        self.previous_capture_token = server.CAPTURE_TOKEN
        self.previous_supabase_url = server.SUPABASE_URL
        self.previous_supabase_key = server.SUPABASE_KEY
        server.BACKUP_DIR = Path(self.temporary_directory.name)
        server.INBOX_PATH = server.BACKUP_DIR / "external-inbox.json"
        server.SYNC_STATUS_PATH = server.BACKUP_DIR / "cloud-sync-status.json"
        server.CAPTURE_TOKEN = ""
        server.SUPABASE_URL = ""
        server.SUPABASE_KEY = ""
        self.httpd = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.httpd.server_port}"

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        server.BACKUP_DIR = self.previous_backup_dir
        server.INBOX_PATH = self.previous_inbox_path
        server.SYNC_STATUS_PATH = self.previous_sync_status_path
        server.CAPTURE_TOKEN = self.previous_capture_token
        server.SUPABASE_URL = self.previous_supabase_url
        server.SUPABASE_KEY = self.previous_supabase_key
        self.temporary_directory.cleanup()

    def write_backup(self, name, payload):
        server.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        (server.BACKUP_DIR / name).write_text(json.dumps(payload), encoding="utf-8")

    def read_json(self, path):
        with urlopen(f"{self.base_url}{path}") as response:
            return json.load(response)

    def post_json(self, path, payload, headers=None):
        request = Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", **(headers or {})},
        )
        with urlopen(request) as response:
            return response.status, json.load(response)

    def test_corrupt_latest_backup_is_skipped(self):
        self.write_backup("later-space-20260102T000000Z.json", {"broken": True})
        self.write_backup("later-space-20260101T000000Z.json", {
            "app": "Later Space", "images": [{"id": "healthy"}],
        })
        payload = self.read_json("/api/backups/latest")
        self.assertEqual(payload["images"][0]["id"], "healthy")

    def test_backup_with_missing_asset_is_skipped(self):
        missing_hash = "a" * 64
        self.write_backup("later-space-20260102T000000Z.json", {
            "app": "Later Space", "images": [{"id": "missing", "assetHash": missing_hash}],
        })
        self.write_backup("later-space-20260101T000000Z.json", {
            "app": "Later Space", "images": [{"id": "healthy"}],
        })
        payload = self.read_json("/api/backups/latest")
        self.assertEqual(payload["images"][0]["id"], "healthy")

    def test_healthy_asset_is_embedded_for_restore(self):
        asset_hash = "b" * 64
        asset_dir = server.BACKUP_DIR / "assets"
        asset_dir.mkdir(parents=True)
        asset_dir.joinpath(f"{asset_hash}.dataurl").write_text(
            "data:text/plain;base64,aGVsbG8=", encoding="utf-8",
        )
        self.write_backup("later-space-20260102T000000Z.json", {
            "app": "Later Space", "images": [{"id": "image", "assetHash": asset_hash}],
        })
        payload = self.read_json("/api/backups/latest")
        self.assertEqual(payload["images"][0]["dataUrl"], "data:text/plain;base64,aGVsbG8=")

    def test_no_healthy_backup_returns_not_found(self):
        self.write_backup("later-space-20260102T000000Z.json", {"broken": True})
        with self.assertRaises(HTTPError) as error:
            self.read_json("/api/backups/latest")
        self.assertEqual(error.exception.code, 404)

    def test_external_inbox_can_be_saved_and_consumed(self):
        status, saved = self.post_json("/api/inbox", {
            "url": "https://example.com/article",
            "title": "Example article",
            "purpose": "Read later",
        })
        self.assertEqual(status, 201)
        self.assertTrue(saved["saved"])
        consumed = self.read_json("/api/inbox?consume=1")
        self.assertEqual(consumed["items"][0]["title"], "Example article")
        self.assertEqual(self.read_json("/api/inbox")["items"], [])

    def test_external_image_capture_can_be_saved_and_consumed(self):
        image_data = "data:image/png;base64,iVBORw0KGgo="
        status, saved = self.post_json("/api/inbox", {
            "kind": "image",
            "imageData": image_data,
            "name": "shared-image.png",
            "mimeType": "image/png",
            "source": "ios-share",
        })
        self.assertEqual(status, 201)
        self.assertTrue(saved["saved"])
        item = self.read_json("/api/inbox?consume=1")["items"][0]
        self.assertEqual(item["kind"], "image")
        self.assertEqual(item["imageData"], image_data)
        self.assertEqual(item["name"], "shared-image.png")

    def test_external_inbox_rejects_invalid_token(self):
        server.CAPTURE_TOKEN = "secret"
        with self.assertRaises(HTTPError) as error:
            self.post_json("/api/inbox", {"text": "private note"})
        self.assertEqual(error.exception.code, 401)
        status, payload = self.post_json(
            "/api/inbox", {"text": "private note"},
            {"X-Later-Space-Token": "secret"},
        )
        self.assertEqual(status, 201)
        self.assertTrue(payload["saved"])
        self.assertEqual(self.read_json("/api/inbox")["items"][0]["text"], "private note")

    def test_cloud_sync_reports_local_mode_when_unconfigured(self):
        payload = self.read_json("/api/sync/status")
        self.assertFalse(payload["configured"])
        self.assertEqual(payload["latestAt"], 0)


if __name__ == "__main__":
    unittest.main()
