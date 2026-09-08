# Later Space 主屏幕 Web App 登录交接设计

日期：2026-09-08

## 目标

用户已经在 iPhone 浏览器中登录 Later Space 后，点击“安装到主屏幕”并完成 iOS 系统操作。第一次从主屏幕打开 Later Space 时，Web App 自动获得同一账号的独立 Supabase Session，不要求用户再次输入邮箱、打开邮件或复制 Token。

首页不强制安装。安装入口保留在登录成功后的引导和“我的 → 同步”中。没有安装需求的用户可以一直在浏览器里使用。

## 平台约束

- iOS 17.2 及以上在创建主屏幕 Web App 时会复制当前浏览器 Cookie，但不会复制 `localStorage` 或 IndexedDB。
- Later Space 当前把 Supabase Session 放在 `localStorage`，所以现有登录状态不会被系统带入主屏幕 Web App。
- GitHub Pages 是静态托管，不能在 Later Space 同源响应中设置 HttpOnly Cookie。
- Supabase refresh token 默认轮换。Safari 和 Web App 不应长期共用同一个 refresh token，否则两边刷新时可能触发重放保护并终止 Session。

## 采用方案

采用“一次性 Cookie + 独立 Session”交接，不把 access token、refresh token、邮箱或用户 ID 写入 Cookie、网址或日志。

### 创建交接

1. 已登录用户点击任一“安装到主屏幕”入口。
2. 网页携带当前 Supabase access token，调用 `pwa-auth-handoff` Edge Function 的 `create` 操作。
3. 函数验证当前用户，生成高熵随机交接码，并通过 Supabase Admin `generateLink` 为该用户创建一个未使用的 email token hash。该操作不发送邮件。
4. 数据库只保存交接码的 SHA-256、Supabase token hash、用户 ID、创建时间、过期时间和使用时间。表不向匿名或普通登录角色开放。
5. 网页把原始交接码写入第一方 Cookie：`Secure; SameSite=Strict; Path=/later-space/; Max-Age=900`。
6. 交接创建成功后，才显示现有的 iOS“添加到主屏幕”三步说明或触发支持平台的原生安装提示。

### 首次打开主屏幕 Web App

1. 页面确认自己运行在 `display-mode: standalone` 中，并读取交接 Cookie。
2. 页面调用 `pwa-auth-handoff` 的 `redeem` 操作提交交接码。
3. Edge Function 以原子方式核对哈希、过期时间与 `consumed_at`，并在同一数据库操作中把交接记录标记为已使用。
4. 函数只向本次兑换返回一次性的 Supabase token hash。
5. Web App 使用 Supabase `verifyOtp({ token_hash, type: "email" })` 换取自己的全新 Session，写入当前 Web App 的 `localStorage`。
6. 无论成功或失败，Web App 都删除交接 Cookie；成功后同步账号内容并显示“登录状态已带过来”。

Safari 原来的 Session 保持不变。Web App 获得的是另一份 Session，两边分别轮换自己的 refresh token。

## 数据模型

新增 `later_space_pwa_handoffs`：

- `id uuid primary key`
- `user_id uuid not null references auth.users on delete cascade`
- `code_hash text unique not null`
- `auth_token_hash text not null`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `consumed_at timestamptz null`

启用 RLS，不向 `anon` 或 `authenticated` 直接授权。只有使用 service role 的 Edge Function 能访问。新增 `consume_later_space_pwa_handoff` 安全函数，使用单条 `UPDATE ... WHERE consumed_at IS NULL AND expires_at > now() RETURNING` 完成原子兑换；同时撤销该函数对 `public`、`anon` 和 `authenticated` 的执行权限，只授予 `service_role`。

创建新交接时，将该用户尚未使用的旧记录标记为已使用。过期记录可以在后续创建请求中顺便删除，不增加定时任务。

## Session 刷新

保留现有遇到 `401` 自动刷新逻辑，并增加按 `expires_at` 调度的主动刷新：在 access token 到期前约五分钟刷新；页面从后台恢复或重新联网时重新检查。刷新失败时清除本地 Session 并显示正常登录入口，不循环重试。

## 用户体验与降级

- 未登录用户点击安装：正常显示安装说明，不创建交接；主屏幕第一次打开显示登录页。
- 已登录且交接创建成功：安装弹窗提示“登录状态会自动带过去，请在 15 分钟内第一次打开”。
- iOS 低于 17.2、无痕浏览、Cookie 被禁用、超过 15 分钟或兑换失败：主屏幕 Web App 显示“一键重新登录”，不显示技术错误和 Token。
- 已经安装：隐藏安装按钮，不创建交接。
- 用户取消安装：短期代码自然过期，不影响当前登录。
- 非 iOS 平台：继续使用 `beforeinstallprompt`；同源存储本来可用时不额外兑换，Cookie 作为安全降级存在并在过期后失效。

## 安全规则

- Cookie 只含至少 256 bit 的随机一次性代码。
- 交接码有效期 15 分钟，只能使用一次。
- 数据库不保存原始交接码。
- Edge Function 响应使用 `Cache-Control: no-store`，不记录交接码和 token hash。
- 创建接口必须验证 Supabase 用户；兑换失败统一返回同一种错误，避免账号枚举。256 bit 随机码使在线猜测不可行。
- 任何路径都不把 Supabase access token、refresh token 或 token hash 放进 URL。
- 登出 Web App 只结束 Web App 当前 Session，不影响 Safari 的独立 Session。

## 代码范围

- `supabase/schema.sql`：交接表、索引和原子消费函数。
- `supabase/functions/pwa-auth-handoff/index.ts`：创建与兑换接口。
- `app.js`：安装前创建 Cookie、standalone 首次兑换、主动刷新调度、降级提示。
- `index.html` / `styles.css`：安装弹窗状态文案与首次交接反馈（仅在需要时调整）。
- `sw.js`：升级缓存版本，确保新认证逻辑及时生效。
- 测试：交接码过期、重复兑换、错误代码、未登录创建、成功兑换、无 Cookie 和旧版 iOS 降级。

## 验收标准

1. iOS 17.2 及以上：Safari 登录后安装，15 分钟内首次从主屏幕打开，无需再次登录即可看到同一账号内容。
2. Safari 与主屏幕 Web App 同时继续使用，分别刷新 Session，不互相退出。
3. 抓包、地址栏、日志和 Cookie 中都没有长期 Supabase Session Token。
4. 同一交接码第二次兑换失败；超过 15 分钟兑换失败。
5. 失败时用户可以正常重新登录，原有浏览器登录与收藏不受影响。
6. 不安装 Web App 的用户流程不发生变化。
