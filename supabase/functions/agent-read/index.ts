import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function clean(value: unknown, max = 200) { return String(value || "").replace(/\0/g, "").trim().slice(0, max); }
async function hash(value: string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function newToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return `ls_agent_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`; }
function isoTime(value: unknown, fallback = "") { const numeric = Number(value); if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString(); const date = new Date(String(value || fallback)); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function publicItem(row: any) { const data = row.data || {}; return { id: row.id, kind: row.kind, title: data.title || data.name || "", text: row.kind === "text" ? data.text || "" : "", url: row.kind === "link" ? data.url || "" : "", description: data.description || "", purpose: data.purpose || data.note || "", tags: Array.isArray(data.tags) ? data.tags : [], source: data.source || "", saved_at: isoTime(data.createdAt, row.created_at), updated_at: isoTime(data.updatedAt, row.server_updated_at || row.created_at), has_media: Boolean(row.asset_path) }; }
async function userFromJwt(request: Request) { const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); if (!jwt) return null; const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } }); const { data } = await client.auth.getUser(jwt); return data.user?.id || null; }
async function agentUser(request: Request, admin: ReturnType<typeof createClient>) { const raw = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim(); if (!raw.startsWith("ls_agent_")) return null; const tokenHash = await hash(raw); const { data } = await admin.from("later_space_agent_tokens").select("id,user_id,scope").eq("token_hash", tokenHash).is("revoked_at", null).maybeSingle(); if (!data || data.scope !== "items:read") return null; await admin.from("later_space_agent_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id); return data.user_id as string; }

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!url || !serviceKey) return json({ error: "server_not_configured" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const parsed = new URL(request.url);
  if (request.method === "POST" && parsed.pathname.endsWith("/agent-read")) {
    const userId = await userFromJwt(request); if (!userId) return json({ error: "invalid_session" }, 401);
    const body = await request.json().catch(() => ({})); const token = newToken();
    const { error: revokeError } = await admin.from("later_space_agent_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).is("revoked_at", null);
    if (revokeError) return json({ error: "token_revoke_failed" }, 500);
    const { error } = await admin.from("later_space_agent_tokens").insert({ user_id: userId, name: clean(body.name, 80) || "Agent", token_hash: await hash(token), token_hint: token.slice(-8), scope: "items:read" });
    if (error) return json({ error: "token_create_failed" }, 500);
    return json({ token, scope: "items:read" }, 201);
  }
  const userId = await agentUser(request, admin); if (!userId) return json({ error: "invalid_agent_token" }, 401);
  const id = parsed.pathname.match(/\/items\/([^/]+)$/)?.[1];
  if (id) { const { data, error } = await admin.from("later_space_items").select("id,kind,data,asset_path,created_at,client_updated_at").eq("user_id", userId).eq("id", id).is("deleted_at", null).maybeSingle(); if (error) return json({ error: "query_failed" }, 500); if (!data) return json({ error: "not_found" }, 404); return json({ item: publicItem(data) }); }
  const q = clean(parsed.searchParams.get("q"), 200).toLowerCase(); const kind = clean(parsed.searchParams.get("type"), 20); const tags = clean(parsed.searchParams.get("tag"), 80).toLowerCase(); const limit = Math.min(50, Math.max(1, Number(parsed.searchParams.get("limit") || 20))); const offset = Math.min(5000, Math.max(0, Number(parsed.searchParams.get("offset") || 0)));
  let data: any[] | null = null; let total = 0;
  if (!q && !tags) {
    let query = admin.from("later_space_items").select("id,kind,data,asset_path,created_at,client_updated_at,server_updated_at", { count: "exact" }).eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false });
    if (kind) query = query.eq("kind", kind);
    const result = await query.range(offset, offset + limit - 1); data = result.data; total = result.count || 0; if (result.error) return json({ error: "query_failed" }, 500);
  } else {
    const result = await admin.from("later_space_items").select("id,kind,data,asset_path,created_at,client_updated_at,server_updated_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(500); if (result.error) return json({ error: "query_failed" }, 500);
    const filtered = (result.data || []).map(publicItem).filter((item) => (!kind || item.kind === kind) && (!tags || item.tags.some((tag: string) => tag.toLowerCase() === tags)) && (!q || JSON.stringify(item).toLowerCase().includes(q))); total = filtered.length; return json({ items: filtered.slice(offset, offset + limit), count: Math.max(0, Math.min(limit, total - offset)), total, offset, limit, has_more: offset + limit < total });
  }
  const items = (data || []).map(publicItem); return json({ items, count: items.length, total, offset, limit, has_more: offset + items.length < total });
});
