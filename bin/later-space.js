#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const configPath = path.join(os.homedir(), ".later-space-agent.json");
const defaultUrl = "https://hesftvntzoawxryhadcw.supabase.co/functions/v1/agent-read";
function fail(message, code = 1) { console.error(message); process.exit(code); }
function loadConfig() { try { return JSON.parse(fs.readFileSync(configPath, "utf8")); } catch { return {}; } }
function saveConfig(config) { fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 }); }
function usage() { console.error("Usage: later-space <auth|recent|search|get> [args]"); process.exit(2); }
async function main() {
  const [, , command, ...args] = process.argv;
  const config = loadConfig();
  if (command === "auth") { const token = args[0]; if (!token?.startsWith("ls_agent_")) fail("Provide an Agent Token"); saveConfig({ ...config, token, url: process.env.LATER_SPACE_AGENT_URL || config.url || defaultUrl }); console.log(JSON.stringify({ saved: true, path: configPath })); return; }
  const baseUrl = process.env.LATER_SPACE_AGENT_URL || config.url || defaultUrl; const token = process.env.LATER_SPACE_AGENT_TOKEN || config.token;
  if (!token) fail("Configure your token with: later-space auth <token>");
  let endpoint = "/items";
  if (command === "search") endpoint += `?q=${encodeURIComponent(args.join(" "))}`;
  else if (command === "recent") endpoint += `?limit=${encodeURIComponent(args[0] || 20)}`;
  else if (command === "get") { if (!args[0]) usage(); endpoint += `/${encodeURIComponent(args[0])}`; }
  else usage();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const body = await response.text(); if (!response.ok) fail(body || `HTTP ${response.status}`, response.status === 401 ? 3 : 1); console.log(body);
}
main().catch((error) => fail(error.message));
