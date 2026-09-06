import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
FUNCTION = (ROOT / "supabase" / "functions" / "agent-read" / "index.ts").read_text(encoding="utf-8")
APP = (ROOT / "app.js").read_text(encoding="utf-8")
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


class AgentReadContractTests(unittest.TestCase):
    def test_agent_tokens_are_scoped_and_hash_only(self):
        self.assertIn("create table if not exists public.later_space_agent_tokens", SCHEMA)
        self.assertIn("user_id uuid not null references auth.users(id)", SCHEMA)
        self.assertIn("token_hash text not null unique", SCHEMA)
        self.assertIn("scope text not null default 'items:read' check (scope = 'items:read')", SCHEMA)
        self.assertIn("alter table public.later_space_agent_tokens enable row level security", SCHEMA)

    def test_function_revokes_previous_tokens_and_requires_agent_prefix(self):
        self.assertIn('raw.startsWith("ls_agent_")', FUNCTION)
        self.assertIn('eq("user_id", userId).is("revoked_at", null)', FUNCTION)
        self.assertIn('scope !== "items:read"', FUNCTION)

    def test_api_has_bounded_pagination_and_public_fields(self):
        self.assertIn("Math.min(50", FUNCTION)
        self.assertIn("Math.min(5000", FUNCTION)
        self.assertIn("has_more", FUNCTION)
        self.assertIn("function publicItem", FUNCTION)
        self.assertIn("isoTime", FUNCTION)
        self.assertNotIn("serviceKey) });", FUNCTION)

    def test_frontend_exposes_agent_entry(self):
        self.assertIn("createAgentTokenButton", INDEX)
        self.assertIn("createAgentToken", APP)
        self.assertIn("重新生成会让旧 Token 失效", INDEX)


if __name__ == "__main__":
    unittest.main()
