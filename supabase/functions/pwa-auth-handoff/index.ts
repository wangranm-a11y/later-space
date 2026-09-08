import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HANDOFF_TTL_MS = 15 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(jwt);
  return error ? null : data.user;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, code: "server_not_configured" }, 503);
  }

  let body: { action?: string; handoffCode?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, code: "invalid_request" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "create") {
    const user = await authenticatedUser(request);
    if (!user?.email) return jsonResponse({ ok: false, code: "unauthorized" }, 401);

    const handoffCode = randomCode();
    const codeHash = await sha256Hex(handoffCode);
    const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    const authTokenHash = linkData?.properties?.hashed_token;
    if (linkError || !authTokenHash) return jsonResponse({ ok: false, code: "handoff_unavailable" }, 503);

    const now = new Date().toISOString();
    await admin
      .from("later_space_pwa_handoffs")
      .update({ consumed_at: now })
      .eq("user_id", user.id)
      .is("consumed_at", null);
    await admin
      .from("later_space_pwa_handoffs")
      .delete()
      .lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { error: insertError } = await admin.from("later_space_pwa_handoffs").insert({
      user_id: user.id,
      code_hash: codeHash,
      auth_token_hash: authTokenHash,
      expires_at: expiresAt,
    });
    if (insertError) return jsonResponse({ ok: false, code: "handoff_unavailable" }, 503);
    return jsonResponse({ ok: true, handoffCode, expiresAt });
  }

  if (body.action === "redeem") {
    const handoffCode = String(body.handoffCode || "").trim();
    if (!/^[a-f0-9]{64}$/i.test(handoffCode)) {
      return jsonResponse({ ok: false, code: "handoff_invalid" }, 400);
    }
    const codeHash = await sha256Hex(handoffCode);
    const { data, error } = await admin.rpc("consume_later_space_pwa_handoff", { p_code_hash: codeHash });
    const tokenHash = Array.isArray(data) ? data[0]?.auth_token_hash : null;
    if (error || !tokenHash) return jsonResponse({ ok: false, code: "handoff_invalid" }, 400);
    return jsonResponse({ ok: true, tokenHash });
  }

  return jsonResponse({ ok: false, code: "invalid_request" }, 400);
});
