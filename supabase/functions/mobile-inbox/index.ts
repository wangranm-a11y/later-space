import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MEDIA_BUCKET = "later-space-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-later-space-kind, x-later-space-name",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CaptureKind = "image" | "link" | "text";

type CapturePayload = {
  kind: CaptureKind;
  text?: string;
  url?: string;
  title?: string;
  name?: string;
  mimeType?: string;
  bytes?: Uint8Array;
};

function textResponse(message: string, status = 200, code = "ok") {
  return new Response(message, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Later-Space-Code": code,
      "Cache-Control": "no-store",
    },
  });
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function cleanText(value: unknown, maxLength = 200_000) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, maxLength);
}

function canonicalUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from", "source"]
    .forEach((key) => url.searchParams.delete(key));
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  url.searchParams.sort();
  return url.href;
}

function looksLikeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function canonicalCandidate(value: string) {
  const candidate = decodeHtmlEntities(value).replace(/[),.;!?]+$/, "");
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return canonicalUrl(url.href);
  } catch {
    return "";
  }
}

function extractSharedUrl(value: string) {
  const withoutMarkup = value
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const metadataPatterns = [
    /<meta\b[^>]*(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:url|twitter:url)["'][^>]*>/i,
    /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i,
    /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i,
  ];
  for (const pattern of metadataPatterns) {
    const metadataMatch = value.match(pattern);
    const metadataUrl = metadataMatch ? canonicalCandidate(metadataMatch[1]) : "";
    if (metadataUrl) return metadataUrl;
  }

  const match = withoutMarkup.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return "";
  return canonicalCandidate(match[0]);
}

function normalizeSharedText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sha256Hex(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function payloadFromSharedText(rawValue: string, forcedKind?: string): CapturePayload {
  const rawText = cleanText(rawValue);
  if (!rawText) throw new Error("empty_text");
  const sharedUrl = extractSharedUrl(rawText);
  if (forcedKind === "link" || sharedUrl || looksLikeUrl(rawText)) {
    return { kind: "link", url: sharedUrl || canonicalUrl(rawText) };
  }
  const text = normalizeSharedText(rawText);
  if (!text) throw new Error("unsupported_shared_file");
  return { kind: "text", text };
}

async function payloadFromSharedFile(file: File, forcedKind?: string): Promise<CapturePayload> {
  const mimeType = (file.type || "").toLowerCase().split(";")[0];
  if (mimeType.startsWith("image/")) {
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("unsupported_image");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) throw new Error("empty_image");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image_too_large");
    return {
      kind: "image",
      bytes,
      mimeType,
      name: cleanText(file.name, 240) || `Later Space ${new Date().toISOString()}.${extensionForType(mimeType)}`,
    };
  }
  return payloadFromSharedText(await file.text(), forcedKind);
}

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function readCapture(request: Request): Promise<CapturePayload> {
  const fullContentType = request.headers.get("content-type") || "text/plain";
  const contentType = fullContentType.split(";")[0].toLowerCase();
  const forcedKind = request.headers.get("x-later-space-kind")?.toLowerCase();

  if (contentType === "application/json") {
    const rawJson = await request.text();
    let body: Record<string, unknown> | string;
    try {
      body = JSON.parse(rawJson);
    } catch {
      return payloadFromSharedText(rawJson, forcedKind);
    }
    if (typeof body === "string") return payloadFromSharedText(body, forcedKind);
    if (body.url && typeof body.url === "string") {
      return { kind: "link", url: canonicalUrl(cleanText(body.url)), title: cleanText(body.title, 500) };
    }
    const declaredKind = cleanText(body.kind, 20);
    if (declaredKind === "link") {
      const url = canonicalUrl(cleanText(body.url));
      return { kind: "link", url, title: cleanText(body.title, 500) };
    }
    if (declaredKind === "text") {
      const text = cleanText(body.text);
      if (!text) throw new Error("empty_text");
      return { kind: "text", text };
    }
    throw new Error("unsupported_kind");
  }

  if (contentType.startsWith("image/") || forcedKind === "image") {
    const mimeType = contentType.startsWith("image/") ? contentType : "application/octet-stream";
    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("unsupported_image");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) throw new Error("empty_image");
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error("image_too_large");
    return {
      kind: "image",
      bytes,
      mimeType,
      name: cleanText(request.headers.get("x-later-space-name"), 240) || `Later Space ${new Date().toISOString()}.${extensionForType(mimeType)}`,
    };
  }

  // Shortcuts may encode “Request Body: File” as multipart/form-data.
  // Unwrap the file before trying to parse X/Safari HTML or plain text.
  if (contentType === "multipart/form-data") {
    const form = await request.formData();
    let textParts = "";
    for (const value of form.values()) {
      if (typeof value === "string") {
        textParts += `\n${value}`;
      } else if (value && typeof value === "object" && "text" in value) {
        const payload = await payloadFromSharedFile(value as File, forcedKind);
        if (payload.kind === "image" || payload.kind === "link") return payload;
        textParts += `\n${payload.text || ""}`;
      }
    }
    return payloadFromSharedText(textParts, forcedKind);
  }

  // Some iOS versions label a text/HTML file as application/octet-stream.
  // Decode it as text so the og:url/canonical URL can still be recovered.
  if (contentType === "application/octet-stream") {
    const bytes = new Uint8Array(await request.arrayBuffer());
    return payloadFromSharedText(new TextDecoder().decode(bytes), forcedKind);
  }

  return payloadFromSharedText(await request.text(), forcedKind);
}

function userMessageForError(code: string) {
  const messages: Record<string, string> = {
    missing_token: "请先在 Later Space 里重新连接手机快捷收件",
    invalid_token: "手机收件地址已经失效，请在 Later Space 里重新生成",
    invalid_session: "登录已失效，请重新登录 Later Space",
    empty_text: "没有找到可以保存的文字",
    empty_image: "没有找到可以保存的图片",
    unsupported_kind: "这个内容暂时还不能收进 Later Space",
    unsupported_shared_file: "这个分享格式无法识别，请从 X 分享原始链接或图片",
    unsupported_image: "请先把图片转换成 JPG、PNG 或 WebP",
    image_too_large: "图片仍然太大，请先缩小后再试",
    user_storage_full: "你的图片空间已满，请先在 Later Space 删除一些图片",
    system_storage_full: "Later Space 图片空间暂时已满，仍可收藏文字和链接",
    image_uploads_disabled: "Later Space 图片上传暂时停用，仍可收藏文字和链接",
  };
  return messages[code] || "没有保存成功，请稍后重试";
}

async function resolveUserId(request: Request, admin: ReturnType<typeof createClient>) {
  const url = new URL(request.url);
  const captureToken = cleanText(url.searchParams.get("token"), 500);
  if (captureToken) {
    const tokenHash = await sha256Hex(captureToken);
    const { data, error } = await admin
      .from("later_space_capture_tokens")
      .select("id,user_id")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (error || !data) throw new Error("invalid_token");
    await admin.from("later_space_capture_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    return data.user_id as string;
  }

  const authorization = request.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("missing_token");
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(jwt);
  if (error || !data.user) throw new Error("invalid_session");
  return data.user.id;
}

function recordData(payload: CapturePayload, now: number) {
  const common = {
    status: "inbox",
    tags: [],
    note: "",
    source: "ios-shortcut",
    createdAt: now,
    updatedAt: now,
    canvasX: 0,
    canvasY: 0,
    zIndex: now,
  };
  if (payload.kind === "link") {
    return { ...common, kind: "link", url: payload.url, title: payload.title || payload.url, name: payload.title || payload.url, canvasWidth: 320 };
  }
  if (payload.kind === "text") {
    return { ...common, kind: "text", text: payload.text, name: payload.text?.slice(0, 32), textTheme: "paper", canvasWidth: 300, textHeight: 375, textScale: 1 };
  }
  return { ...common, kind: "image", name: payload.name, type: payload.mimeType, size: payload.bytes?.length || 0, canvasWidth: 280 };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return textResponse("只支持从分享菜单收进 Later Space", 405, "method_not_allowed");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return textResponse("Later Space 云端尚未配置完成", 503, "server_not_configured");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  let reservedBytes = 0;
  let userId = "";
  let uploadedPath = "";

  try {
    userId = await resolveUserId(request, admin);
    const requestUrl = new URL(request.url);
    const mode = requestUrl.searchParams.get("mode") || "capture";

    if (mode === "discard") {
      const body = await request.json();
      const assetPath = cleanText(body.assetPath, 1000);
      const assetBytes = Number(body.assetBytes || 0);
      if (!assetPath.startsWith(`${userId}/`) || !Number.isSafeInteger(assetBytes) || assetBytes <= 0) {
        return jsonResponse({ ok: false, code: "invalid_asset" }, 400);
      }
      const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove([assetPath]);
      if (removeError) return jsonResponse({ ok: false, code: "asset_remove_failed" }, 503);
      await admin.rpc("release_later_space_storage", { p_user_id: userId, p_bytes: assetBytes });
      return jsonResponse({ ok: true });
    }

    const payload = await readCapture(request);
    const normalized = payload.kind === "image"
      ? payload.bytes as Uint8Array
      : `${payload.kind}:${payload.kind === "link" ? payload.url : payload.text}`;
    const contentHash = await sha256Hex(normalized);

    const { data: duplicate } = await admin
      .from("later_space_items")
      .select("id")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .is("deleted_at", null)
      .maybeSingle();
    if (duplicate && mode !== "asset") return textResponse("这条内容已经在 Later Space 里", 200, "duplicate");

    const now = Date.now();
    const id = crypto.randomUUID();
    let assetPath: string | null = null;

    if (payload.kind === "image") {
      reservedBytes = payload.bytes?.length || 0;
      const { data: reservation, error: reservationError } = await admin.rpc("reserve_later_space_storage", {
        p_user_id: userId,
        p_bytes: reservedBytes,
      });
      if (reservationError) throw new Error("storage_check_failed");
      if (!reservation?.ok) throw new Error(reservation?.code || "storage_check_failed");

      assetPath = `${userId}/${id}/${now}.${extensionForType(payload.mimeType || "image/jpeg")}`;
      uploadedPath = assetPath;
      const { error: uploadError } = await admin.storage
        .from(MEDIA_BUCKET)
        .upload(assetPath, payload.bytes as Uint8Array, { contentType: payload.mimeType, upsert: false });
      if (uploadError) throw new Error("asset_upload_failed");
    }

    if (mode === "asset") {
      const recordId = cleanText(requestUrl.searchParams.get("record_id"), 100);
      if (payload.kind !== "image" || !/^[a-zA-Z0-9-]{8,100}$/.test(recordId)) throw new Error("invalid_asset");
      const result = { ok: true, assetPath, assetBytes: reservedBytes, contentHash };
      reservedBytes = 0;
      uploadedPath = "";
      return jsonResponse(result, 201);
    }

    const { error: rowError } = await admin.from("later_space_items").insert({
      id,
      user_id: userId,
      kind: payload.kind,
      data: recordData(payload, now),
      asset_path: assetPath,
      asset_bytes: reservedBytes,
      content_hash: contentHash,
      source_device_id: "ios-shortcut",
      client_updated_at: now,
      deleted_at: null,
    });
    if (rowError) throw new Error(rowError.code === "23505" ? "duplicate" : "row_write_failed");

    return textResponse("✓ 已加入 Later Space", 201, "saved");
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown_error";
    if (uploadedPath) await admin.storage.from(MEDIA_BUCKET).remove([uploadedPath]).catch(() => null);
    if (reservedBytes && userId) {
      await admin.rpc("release_later_space_storage", { p_user_id: userId, p_bytes: reservedBytes }).catch(() => null);
    }
    if (code === "duplicate") return textResponse("✓ 已加入 Later Space", 200, "duplicate");
    const clientCodes = new Set([
      "missing_token", "invalid_token", "invalid_session", "empty_text", "empty_image", "unsupported_kind",
      "unsupported_image", "unsupported_shared_file", "image_too_large", "user_storage_full", "system_storage_full", "image_uploads_disabled",
    ]);
    return textResponse(userMessageForError(code), clientCodes.has(code) ? 400 : 503, code);
  }
});
