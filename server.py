from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import socket
import threading
import base64
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urljoin, urlparse
from urllib.request import Request, urlopen

HOST = os.environ.get("LATER_SPACE_HOST", "127.0.0.1")
PORT = int(os.environ.get("LATER_SPACE_PORT", "5177"))
MAX_BYTES = 1_500_000
MAX_CAPTURE_BYTES = 12_000_000
MAX_BACKUP_BYTES = 250_000_000
BACKUP_LIMIT = 10
ASSET_HASH_PATTERN = re.compile(r"^[a-f0-9]{64}$")
BACKUP_DIR = Path(os.environ.get(
    "LATER_SPACE_BACKUP_DIR",
    str(Path(__file__).resolve().parent / "backups"),
)).expanduser().resolve()
INBOX_PATH = BACKUP_DIR / "external-inbox.json"
INBOX_LOCK = threading.Lock()
CAPTURE_TOKEN = os.environ.get("LATER_SPACE_CAPTURE_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("LATER_SPACE_SUPABASE_BUCKET", "later-space")
SUPABASE_OBJECT = os.environ.get("LATER_SPACE_SUPABASE_OBJECT", "backups/latest.json")
SYNC_STATUS_PATH = BACKUP_DIR / "cloud-sync-status.json"

OEMBED_PROVIDERS = {
    "youtube.com": "https://www.youtube.com/oembed?format=json&url={url}",
    "youtu.be": "https://www.youtube.com/oembed?format=json&url={url}",
    "tiktok.com": "https://www.tiktok.com/oembed?url={url}",
    "vimeo.com": "https://vimeo.com/api/oembed.json?url={url}",
}


def is_public_url(value: str) -> bool:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            return False
    return True


def read_json(value: str) -> dict[str, object]:
    request = Request(value, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urlopen(request, timeout=7) as response:
        return json.loads(response.read(MAX_BYTES).decode("utf-8", errors="replace"))


def x_status_parts(value: str) -> tuple[str, str] | None:
    match = re.search(r"(?:x|twitter)\.com/([^/]+)/status/(\d+)", value, re.IGNORECASE)
    return (match.group(1), match.group(2)) if match else None


def x_fallback_preview(value: str) -> dict[str, str] | None:
    parts = x_status_parts(value)
    if not parts:
        return None
    username, status_id = parts
    payload = read_json(f"https://api.fxtwitter.com/{quote(username)}/status/{status_id}")
    tweet = payload.get("tweet")
    if not isinstance(tweet, dict):
        return None
    post_text = clean_text(str(tweet.get("text", "")))
    return {
        "title": post_text[:240] or f"X 帖子 · {status_id[-6:]}",
        "description": "",
        "image": "",
        "siteName": "X",
        "url": value,
    }


def social_preview(value: str) -> dict[str, str] | None:
    host = (urlparse(value).hostname or "").lower().removeprefix("www.")
    if host in {"x.com", "twitter.com", "mobile.twitter.com"}:
        try:
            payload = read_json(f"https://publish.twitter.com/oembed?omit_script=true&dnt=true&url={quote(value, safe='')}")
            post_text = clean_text(str(payload.get("html", "")))
            post_text = re.sub(r"\s*[—-]\s*[^—-]+\(@[^)]+\)\s+.*$", "", post_text).strip()
            if post_text:
                return {
                    "title": post_text[:240],
                    "description": "",
                    "image": "",
                    "siteName": "X",
                    "url": value,
                }
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            pass
        try:
            fallback = x_fallback_preview(value)
            if fallback:
                return fallback
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
            pass
        parts = x_status_parts(value)
        return {
            "title": f"X 帖子 · {parts[1][-6:]}" if parts else "X 帖子",
            "description": "",
            "image": "",
            "siteName": "X",
            "url": value,
        }
    provider = next((template for domain, template in OEMBED_PROVIDERS.items() if host == domain or host.endswith(f".{domain}")), None)
    if not provider:
        return None
    payload = read_json(provider.format(url=quote(value, safe="")))
    return {
        "title": str(payload.get("title", ""))[:240],
        "description": str(payload.get("author_name", ""))[:500],
        "image": str(payload.get("thumbnail_url", "")),
        "siteName": str(payload.get("provider_name", host))[:80],
        "url": value,
    }


def meta_value(source: str, names: list[str]) -> str:
    for name in names:
        escaped = re.escape(name)
        patterns = [
            rf'<meta[^>]+(?:property|name)=["\']{escaped}["\'][^>]+content=["\']([^"\']+)',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{escaped}["\']',
        ]
        for pattern in patterns:
            match = re.search(pattern, source, re.IGNORECASE)
            if match:
                return html.unescape(match.group(1).strip())
    return ""


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(re.sub(r"\s+", " ", value)).strip()


def json_ld_title(source: str) -> str:
    scripts = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        source,
        re.IGNORECASE | re.DOTALL,
    )

    def find_title(value: object) -> str:
        if isinstance(value, dict):
            for key in ("headline", "name", "title"):
                candidate = value.get(key)
                if isinstance(candidate, str) and 3 < len(candidate.strip()) < 300:
                    return candidate.strip()
            for child in value.values():
                candidate = find_title(child)
                if candidate:
                    return candidate
        elif isinstance(value, list):
            for child in value:
                candidate = find_title(child)
                if candidate:
                    return candidate
        return ""

    for script in scripts:
        try:
            candidate = find_title(json.loads(html.unescape(script)))
            if candidate:
                return candidate
        except (json.JSONDecodeError, TypeError):
            continue
    return ""


def visible_heading(source: str) -> str:
    for tag in ("h1", "h2"):
        matches = re.findall(rf"<{tag}[^>]*>(.*?)</{tag}>", source, re.IGNORECASE | re.DOTALL)
        for match in matches:
            candidate = clean_text(match)
            if 3 < len(candidate) < 240:
                return candidate
    return ""


def clean_title(value: str, site_name: str) -> str:
    title = clean_text(value)
    if site_name:
        title = re.sub(rf"\s*[-–—_|｜]\s*{re.escape(site_name)}\s*$", "", title, flags=re.IGNORECASE)
    return title.strip()


def fetch_preview(value: str) -> dict[str, str]:
    try:
        social = social_preview(value)
        if social and social.get("title"):
            return social
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError):
        pass
    if not is_public_url(value):
        raise ValueError("Only public HTTP(S) URLs are supported")
    request = Request(
        value,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        },
    )
    with urlopen(request, timeout=7) as response:
        final_url = response.geturl()
        if not is_public_url(final_url):
            raise ValueError("Redirected to a non-public URL")
        content_type = response.headers.get_content_type()
        if content_type not in {"text/html", "application/xhtml+xml"}:
            raise ValueError("URL is not an HTML page")
        charset = response.headers.get_content_charset() or "utf-8"
        source = response.read(MAX_BYTES).decode(charset, errors="replace")
    site_name = meta_value(source, ["og:site_name", "application-name"])
    title = meta_value(source, ["og:title", "twitter:title", "parsely-title", "sailthru.title"])
    if not title:
        title_match = re.search(r"<title[^>]*>(.*?)</title>", source, re.IGNORECASE | re.DOTALL)
        title = clean_text(title_match.group(1)) if title_match else ""
    generic_titles = {"", "小红书", "登录", "login", "安全验证", "验证码"}
    if title.strip().lower() in generic_titles:
        title = json_ld_title(source) or visible_heading(source) or title
    title = clean_title(title, site_name)
    image = meta_value(source, ["og:image", "twitter:image", "twitter:image:src"])
    description = meta_value(source, ["og:description", "description", "twitter:description"])
    return {
        "title": title[:240],
        "description": description[:500],
        "image": urljoin(final_url, image) if image else "",
        "siteName": site_name[:80],
        "url": final_url,
    }


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        if self.path.startswith("/api/inbox"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Later-Space-Token")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def capture_authorized(self, allow_loopback: bool = False) -> bool:
        if allow_loopback:
            try:
                if ipaddress.ip_address(self.client_address[0]).is_loopback:
                    return True
            except ValueError:
                pass
        return not CAPTURE_TOKEN or self.headers.get("X-Later-Space-Token", "") == CAPTURE_TOKEN

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/inbox":
            if not self.capture_authorized(allow_loopback=True):
                return self.send_json(401, {"error": "Invalid capture token"})
            consume = parse_qs(parsed.query).get("consume", ["0"])[0] == "1"
            with INBOX_LOCK:
                try:
                    items = json.loads(INBOX_PATH.read_text(encoding="utf-8")) if INBOX_PATH.exists() else []
                except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                    items = []
                if consume and items:
                    INBOX_PATH.write_text("[]", encoding="utf-8")
            return self.send_json(200, {"items": items})
        if parsed.path == "/api/sync/status":
            latest_at = 0
            try:
                latest_at = float(json.loads(SYNC_STATUS_PATH.read_text(encoding="utf-8")).get("latestAt", 0))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError, TypeError):
                pass
            return self.send_json(200, {"configured": bool(SUPABASE_URL and SUPABASE_KEY), "latestAt": latest_at})
        if parsed.path == "/api/sync/latest":
            if not SUPABASE_URL or not SUPABASE_KEY:
                return self.send_json(503, {"error": "Supabase is not configured"})
            request = Request(
                f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET)}/{quote(SUPABASE_OBJECT)}",
                headers={"Authorization": f"Bearer {SUPABASE_KEY}", "apikey": SUPABASE_KEY},
            )
            try:
                with urlopen(request, timeout=30) as response:
                    body = response.read(MAX_BACKUP_BYTES)
                payload = json.loads(body.decode("utf-8"))
                return self.send_json(200, payload)
            except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
                return self.send_json(502, {"error": str(error)})
        if parsed.path == "/api/backups/status":
            backups = list(BACKUP_DIR.glob("later-space-*.json")) if BACKUP_DIR.exists() else []
            assets = list((BACKUP_DIR / "assets").glob("*.dataurl")) if (BACKUP_DIR / "assets").exists() else []
            paths = backups + assets
            return self.send_json(200, {
                "count": len(backups),
                "assets": len(assets),
                "bytes": sum(path.stat().st_size for path in paths),
                "latestAt": max((path.stat().st_mtime for path in backups), default=0),
            })
        if parsed.path == "/api/backups/assets":
            asset_dir = BACKUP_DIR / "assets"
            hashes = [path.stem for path in asset_dir.glob("*.dataurl")] if asset_dir.exists() else []
            return self.send_json(200, {"hashes": hashes})
        if parsed.path.startswith("/api/backups/assets/"):
            asset_hash = parsed.path.rsplit("/", 1)[-1]
            if not ASSET_HASH_PATTERN.fullmatch(asset_hash):
                return self.send_json(400, {"error": "Invalid asset hash"})
            asset_path = BACKUP_DIR / "assets" / f"{asset_hash}.dataurl"
            try:
                data_url = asset_path.read_text(encoding="utf-8")
                metadata, encoded = data_url.split(",", 1)
                mime_type = re.match(r"data:([^;]+)", metadata).group(1)
                body = base64.b64decode(encoded, validate=True)
            except (OSError, ValueError, AttributeError):
                return self.send_json(404, {"error": "Asset not found"})
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "private, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path in {"/api/backups/latest", "/api/backups/previous"}:
            backups = sorted(BACKUP_DIR.glob("later-space-*.json"), reverse=True) if BACKUP_DIR.exists() else []
            healthy_backups = []
            asset_dir = BACKUP_DIR / "assets"
            for backup in backups:
                try:
                    payload = json.loads(backup.read_text(encoding="utf-8"))
                    images = payload.get("images")
                    assets_exist = isinstance(images, list) and all(
                        not record.get("assetHash") or (asset_dir / f"{record['assetHash']}.dataurl").exists()
                        for record in images
                    )
                    if payload.get("app") == "Later Space" and isinstance(images, list) and assets_exist:
                        healthy_backups.append((backup, payload))
                except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                    continue
            backup_index = 1 if parsed.path.endswith("previous") else 0
            if len(healthy_backups) <= backup_index:
                return self.send_json(404, {"error": "No backup available"})
            _, payload = healthy_backups[backup_index]
            for record in payload.get("images", []):
                asset_hash = record.get("assetHash")
                asset_path = asset_dir / f"{asset_hash}.dataurl" if asset_hash else None
                if asset_path and ASSET_HASH_PATTERN.fullmatch(asset_hash) and asset_path.exists():
                    record["dataUrl"] = asset_path.read_text(encoding="utf-8")
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path != "/api/preview":
            return super().do_GET()
        value = parse_qs(parsed.query).get("url", [""])[0]
        try:
            payload = fetch_preview(value)
            self.send_json(200, payload)
        except (ValueError, HTTPError, URLError, TimeoutError, OSError) as error:
            self.send_json(422, {"error": str(error)})

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/inbox":
            if not self.capture_authorized():
                return self.send_json(401, {"error": "Invalid capture token"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_CAPTURE_BYTES:
                    return self.send_json(413, {"error": "Capture is too large"})
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                url = str(payload.get("url", "")).strip()
                text = str(payload.get("text", "")).strip()
                image_data = str(payload.get("imageData", "")).strip()
                kind = str(payload.get("kind", "")).strip().lower()
                if kind not in {"link", "text", "image"}:
                    kind = "image" if image_data else "link" if url else "text"
                if not url and not text and not image_data:
                    return self.send_json(400, {"error": "URL, text, or imageData is required"})
                if image_data and not re.fullmatch(r"data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+", image_data):
                    return self.send_json(400, {"error": "Invalid image data"})
                item = {
                    "id": str(payload.get("id") or f"external-{datetime.now(timezone.utc).timestamp()}"),
                    "kind": kind, "url": url[:4000], "text": text[:10000],
                    "imageData": image_data,
                    "name": str(payload.get("name", ""))[:240],
                    "mimeType": str(payload.get("mimeType", ""))[:120],
                    "title": str(payload.get("title", ""))[:240],
                    "purpose": str(payload.get("purpose", ""))[:120],
                    "source": str(payload.get("source", "external"))[:80],
                    "pageUrl": str(payload.get("pageUrl", ""))[:4000],
                    "createdAt": int(payload.get("createdAt") or datetime.now(timezone.utc).timestamp() * 1000),
                }
                BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                with INBOX_LOCK:
                    try:
                        items = json.loads(INBOX_PATH.read_text(encoding="utf-8")) if INBOX_PATH.exists() else []
                    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                        items = []
                    items.append(item)
                    INBOX_PATH.write_text(json.dumps(items[-500:], ensure_ascii=False), encoding="utf-8")
                return self.send_json(201, {"saved": True, "id": item["id"]})
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError, OSError) as error:
                return self.send_json(400, {"error": str(error)})
        if path == "/api/sync/push":
            if not SUPABASE_URL or not SUPABASE_KEY:
                return self.send_json(503, {"error": "Supabase is not configured"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > MAX_BACKUP_BYTES:
                    return self.send_json(413, {"error": "Backup is too large"})
                body = self.rfile.read(length)
                payload = json.loads(body.decode("utf-8"))
                if payload.get("app") != "Later Space" or not isinstance(payload.get("images"), list):
                    return self.send_json(400, {"error": "Invalid backup"})
                request = Request(
                    f"{SUPABASE_URL}/storage/v1/object/{quote(SUPABASE_BUCKET)}/{quote(SUPABASE_OBJECT)}",
                    data=body,
                    method="POST",
                    headers={
                        "Authorization": f"Bearer {SUPABASE_KEY}", "apikey": SUPABASE_KEY,
                        "Content-Type": "application/json", "x-upsert": "true",
                    },
                )
                with urlopen(request, timeout=60) as response:
                    response.read(MAX_BYTES)
                BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                now = datetime.now(timezone.utc).timestamp()
                SYNC_STATUS_PATH.write_text(json.dumps({"latestAt": now}), encoding="utf-8")
                return self.send_json(201, {"syncedAt": now, "count": len(payload["images"])})
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError, HTTPError, URLError, TimeoutError, OSError) as error:
                return self.send_json(502, {"error": str(error)})
        if path != "/api/backups":
            return self.send_json(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BACKUP_BYTES:
                return self.send_json(413, {"error": "Backup is too large"})
            body = self.rfile.read(length)
            payload = json.loads(body.decode("utf-8"))
            if payload.get("app") != "Later Space" or not isinstance(payload.get("images"), list):
                return self.send_json(400, {"error": "Invalid backup"})
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            assets = payload.pop("assets", {})
            if not isinstance(assets, dict):
                return self.send_json(400, {"error": "Invalid backup assets"})
            asset_dir = BACKUP_DIR / "assets"
            asset_dir.mkdir(exist_ok=True)
            for asset_hash, data_url in assets.items():
                if not ASSET_HASH_PATTERN.fullmatch(asset_hash) or not isinstance(data_url, str) or not data_url.startswith("data:"):
                    return self.send_json(400, {"error": "Invalid backup asset"})
                asset_path = asset_dir / f"{asset_hash}.dataurl"
                if not asset_path.exists():
                    temporary_asset = asset_path.with_suffix(".tmp")
                    temporary_asset.write_text(data_url, encoding="utf-8")
                    os.replace(temporary_asset, asset_path)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
            destination = BACKUP_DIR / f"later-space-{stamp}.json"
            temporary = destination.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            os.replace(temporary, destination)
            backups = sorted(BACKUP_DIR.glob("later-space-*.json"), reverse=True)
            for old_backup in backups[BACKUP_LIMIT:]:
                old_backup.unlink(missing_ok=True)
            self.send_json(201, {"savedAt": stamp, "count": len(payload["images"]), "assets": len(assets)})
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError, OSError) as error:
            self.send_json(400, {"error": str(error)})

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Later Space: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
