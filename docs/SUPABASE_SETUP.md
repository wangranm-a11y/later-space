# Later Space 多设备同步设置

Later Space 采用“本地优先 + Supabase 汇合”：IndexedDB 负责立即收藏、离线使用和快速打开；Supabase Auth、Database 与 Storage 负责账户隔离、跨设备合并和恢复。

## 创建项目

1. 在 Supabase 创建一个项目，区域优先选择靠近主要用户的位置。
2. 打开 SQL Editor，完整运行 `supabase/schema.sql`。
3. 在 Authentication 的 URL Configuration 中设置：
   - Site URL：`https://wangranm-a11y.github.io/later-space/`
   - Redirect URL：`https://wangranm-a11y.github.io/later-space/**`
4. 第一版登录建议只开启 Email Magic Link，避免增加密码管理负担。
5. 从 Project Settings → API 复制 Project URL 和 publishable/anon public key，填入 `cloud-config.js`。

```js
window.LATER_SPACE_CLOUD = {
  supabaseUrl: "https://你的项目.supabase.co",
  supabaseAnonKey: "你的 anon public key",
};
```

`anon public key` 可以出现在公开网页中；真正的数据隔离由 `supabase/schema.sql` 中的 RLS 策略保证。不要把 `service_role` key 写进网页、插件、iOS App 或 Git 仓库。

## 同步规则

- 新收藏先写入本机 IndexedDB，再进入后台上传队列。
- 链接、文字、标签、位置和卡片样式保存在 `later_space_items.data`。
- 图片和视频原文件保存在私有 `later-space-media` bucket，路径必须以用户 ID 开头。
- 每台设备记录独立 `device_id`，用 `server_updated_at` 作为增量拉取游标。
- 不同设备创建的不同记录直接合并；同一记录冲突时，以较新的 `client_updated_at` 为准，数据库触发器会拒绝晚到的旧版本。
- 删除只先设置 `deleted_at`，所有设备确认同步后再延迟清理媒体文件。
- 未登录时维持纯本地模式；首次登录前必须让用户选择“合并本地内容”或“保留为本地画布”。

## 上线顺序

1. 创建 Supabase 项目并运行数据库脚本。
2. 接入网页 Email Magic Link 登录。
3. 实现 IndexedDB 待同步队列和逐条双向同步。
4. 将 Chrome 插件继续投递到网页，由网页统一同步。
5. 为 iOS Share Extension 接入同一 Supabase 登录会话和 Storage 上传。
6. 完成双设备新增、编辑、删除、离线重连和恢复演练后再开放给公开用户。
