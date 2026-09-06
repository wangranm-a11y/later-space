#!/usr/bin/env bash
set -euo pipefail

project_ref="hesftvntzoawxryhadcw"
read -r -s -p "Supabase Access Token（输入不会显示）: " later_space_supabase_token
printf '\n'

if [[ -z "$later_space_supabase_token" ]]; then
  echo "未输入 Token，未执行任何操作。" >&2
  exit 1
fi

npx --yes supabase@latest login --token "$later_space_supabase_token"
unset later_space_supabase_token

npx --yes supabase@latest link --project-ref "$project_ref"
npx --yes supabase@latest db query --linked --file supabase/schema.sql
if [[ -f supabase/functions/mobile-inbox/index.ts ]]; then
  npx --yes supabase@latest functions deploy mobile-inbox --no-verify-jwt
fi
npx --yes supabase@latest functions deploy agent-read --no-verify-jwt

echo "Later Space 云端部署完成。"
