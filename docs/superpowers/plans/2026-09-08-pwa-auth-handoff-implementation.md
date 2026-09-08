# Later Space 主屏幕 Web App 登录交接实施计划

依据：`docs/superpowers/specs/2026-09-08-pwa-auth-handoff-design.md`

## 阶段 1：锁定安全契约

1. 新增静态契约测试，覆盖数据库权限、15 分钟过期、原子单次消费和 Edge Function 的 no-store 响应。
2. 覆盖网页只在 standalone 模式兑换、Cookie 不包含 Supabase Session、兑换后删除 Cookie。
3. 覆盖主动 Session 刷新与安装失败降级文案。

## 阶段 2：数据库与 Edge Function

1. 新增 `later_space_pwa_handoffs` 表、RLS 和 service-role-only 原子消费函数。
2. 新增 `pwa-auth-handoff` Edge Function：`create` 验证当前用户并生成短期凭证；`redeem` 单次消费后返回 Supabase email token hash。
3. 为函数关闭网关 JWT 预检，由函数内部区分已认证的创建请求和匿名兑换请求。

## 阶段 3：网页安装与登录交接

1. 已登录用户打开安装指引前先创建交接码并写入 15 分钟 Cookie。
2. standalone Web App 初始化云端前兑换 Cookie，使用 `verifyOtp` 建立独立 Session，并清除 Cookie。
3. 增加 access token 到期前五分钟的主动刷新；联网、聚焦和从后台恢复时重新检查。
4. 更新安装弹窗状态，成功时说明登录会自动带入，失败时不阻断安装。

## 阶段 4：验证与发布

1. 运行 JavaScript、Python 契约测试和 diff 检查。
2. 应用 Supabase schema 并部署 `pwa-auth-handoff` Edge Function。
3. 升级 PWA shell 缓存版本，只暂存本轮文件并提交推送。
4. 验证 GitHub Pages 新版本和 Edge Function 的未认证错误响应；真实 iPhone 安装作为最终设备验收。

## 回滚

- 网页端兑换失败始终回到现有登录页，不影响原登录链路。
- 若线上交接异常，可先移除安装前创建和 standalone 兑换调用；数据库表与函数保留不会影响现有数据。
- 不回滚或复用任何已经消费的交接码。
