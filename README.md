# Later Space 无限收藏画布

一个本地优先的无限收藏画布。文字、图片、视频、网址与社媒分享文案使用同一个入口，也可以直接粘贴到画布；默认显示低视觉噪音的「链接与文字」，并可切换到「素材」或「全部」。链接、文字、图片和视频仍可在筛选面板中进一步细分。所有文字都会在本地自动提取临时标题并收成纸质或深色信息卡片，悬停时提供蓝色反馈；单击选中，双击后会在画布上方打开居中的全文阅读卡片，不会打乱原有排布。链接会提取标题并生成极简文字海报，可从海报或选中工具栏打开原内容。

## 在线版

在线版采用本地优先架构。未登录时，收藏只保存在当前浏览器 IndexedDB 中；正常关闭网页不会丢失，但不能多端同步，清理网站数据后也无法恢复。邮箱登录后，本机内容会默认安全迁移到 Supabase，Mac、iPhone 和其他浏览器共享同一账号数据；断网操作先保存在本机，联网后继续同步。

选中图片后，可以点击「复制图片」或按 `Command/Ctrl + C`，再粘贴到飞书、微信或 Figma。

底部工具栏支持一键整理画布，再次点击即可还原整理前的位置。

文字以固定尺寸的信息卡片留在画布上，支持选中后编辑；双击会打开独立的居中阅读卡片，右上角按钮、卡片外部和 `Esc` 都可以收起，原卡片的位置和周围排布不会改变。

## 启动

```bash
cd /Users/mengwangran/later-space-image-inbox
python3 server.py
```

浏览器打开 `http://127.0.0.1:5177`。

## 未整理与标签

插件、快捷指令和画布内添加的内容默认进入「未整理」。需要时再添加标签；使用过的标签会自动成为顶部子画布入口。

## Chrome 插件

插件默认连接正式版 `https://wangranm-a11y.github.io/later-space/`，不需要运行本地服务。收藏内容由正式页面写入每位用户自己浏览器的 IndexedDB，不会上传到公共仓库或其他用户的数据中。

1. 打开 `chrome://extensions` 并开启右上角「开发者模式」。
2. 从 `plugin-story.html` 下载最新版 zip 并解压；点击「加载已解压的扩展程序」，选择 `later-space-chrome-extension/`。开发者也可以直接选择 `extensions/later-space/`。
3. 浏览网页时点击插件图标，再点「加入 Later Space」收藏当前页面；不会弹出分类表单。
4. 右键网页、链接、图片或选中文字时选择「加入 Later Space」，插件会自动识别内容类型；小红书等带交互遮罩的图片也会尝试识别。也可以按 `Control + Shift + L` 收藏当前页面。
5. 收藏成功后，网页右上角会显示轻量的「已加入 Later Space」提示，并提供跳转和短时「撤销」；点击跳转会先打开 Later Space，再定位并高亮刚加入的卡片。再次打开插件时，也会显示最近一次收藏及查看入口。
6. 选中文字后，选区旁会出现 Later Space 快捷按钮；小红书、X、Google 图片等页面的大图悬停时也会出现图片收藏按钮，用于绕开站点对原生右键菜单的干扰。视频悬停时默认收藏视频封面。
7. Later Space 页面尚未完全打开时，插件会继续等待连接；仍不可用时会在本地排队，并每分钟自动重试。
8. 插件会复用已经打开的 Later Space 页面；未打开时会在后台短暂打开正式页面完成本地入库。

## iPhone 分享入口

正式第一版使用“Web + 云端快捷指令”。用户登录 Later Space 后，在“同步中心”生成并复制个人收件地址；iPhone 快捷指令直接调用 Supabase Edge Function，因此不要求 Mac 开机、同一 Wi-Fi 或保持终端运行。

本地开发兼容入口仍可运行：

```bash
python3 phone_inbox.py
```

本地入口只用于尚未部署云函数时的开发测试。正式手机教程位于 `mobile/ios-shortcut-eli5.html`；云端部署见 `docs/SUPABASE_SETUP.md`。

`ios/` 目录还包含一个 SwiftUI App 和 Share Extension。它支持从 Safari、小红书、相册等 App 分享链接、文字和图片；登录云端后可直接写入 Supabase，发送失败时先保存在 App Group 队列，之后打开 App 自动重试。完整安装步骤见 `ios/README.md`。

GitHub Pages 仍是静态网页，手机公网收件由 Supabase Edge Function 提供。每位用户使用一枚可撤销的个人收件密钥，Supabase 只保存密钥哈希。

## 云端同步

公开多用户版本采用“本地优先 + Supabase Auth/Database/Storage”的逐条同步方案。数据库、私有媒体桶、RLS 权限和部署步骤见 `docs/SUPABASE_SETUP.md`；`service_role` 密钥绝不能放进前端。

当前前端已接入 Email Magic Link、访客/账号工作区、首次默认迁移、逐条双向同步、Realtime、私有优化图片、离线补传、个人手机收件地址和 70%/80%/85% 容量提醒。启用前必须先运行 `supabase/schema.sql` 并部署 `supabase/functions/mobile-inbox`。

不配置云服务时，本地收藏、自动备份和导入导出都可正常使用。下面的环境变量属于原有的个人本地服务“整份画布备份”兼容方案，不提供公开用户账号隔离，也不能合并多设备同时产生的改动：

```bash
SUPABASE_URL="https://你的项目.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="服务端密钥" \
LATER_SPACE_SUPABASE_BUCKET="later-space" \
python3 server.py
```

`SUPABASE_SERVICE_ROLE_KEY` 只放在运行服务的电脑或服务器环境变量里，不要写进网页、插件或仓库。画布底部的云朵按钮可手动上传和恢复完整备份。

## Agent / MCP 路线

Later Space 可以成为用户和 Agent 之间的个人信息层，但 Agent 不应直接读取浏览器 IndexedDB。第一期从 Supabase 的用户云数据提供只读 CLI / MCP：列出最近收藏、按关键词或类型搜索、读取链接/文字元数据和正文；请求复用用户身份并受行级权限保护。第二期再增加带确认的写入、标签整理和删除能力，媒体文件只返回经过授权的短时访问地址。这样既能让 Codex、Claude 等工具读取 Later Space，又不会破坏本地优先和每位用户的数据隔离。

### Agent Read MVP

当前 MVP 已包含 `supabase/functions/agent-read` 和 `bin/later-space.js`。部署 Edge Function、运行 schema 后，在已登录的 Later Space 中通过同一函数创建一次性显示的只读 Token，再在终端配置：

```bash
node bin/later-space.js auth "ls_agent_你的Token"
node bin/later-space.js recent
node bin/later-space.js search "关键词"
node bin/later-space.js get "item-id"
```

Token 只允许读取当前用户未删除的内容；CLI 输出稳定的公开字段，不包含 `user_id`、同步版本、画布坐标或永久媒体地址。MCP 适配层待 API 用真实收藏验证后再加入。

图片与画布位置保存在当前浏览器的 IndexedDB 中。运行本地服务时，内容变化会自动写入 `backups/`，滚动保留最近 10 份状态备份；图片资产按内容哈希只保存一次，避免每次拖动或编辑都重新编码全部高清图片。底部时钟按钮可恢复上一个版本，下载按钮仍可导出完整的独立备份文件。

链接、文字和图片分别按规范化网址、正文和图片内容哈希检测重复；发现重复时会用站内弹窗询问是否仍要收藏，也可以直接定位原内容。图片原图保存在独立的 IndexedDB 资产库；当前版本直接使用原图 Blob 显示，以避开部分 Chrome 环境的 Canvas 黑图问题。内容达到 80 条后，画布只渲染当前视口附近的卡片，搜索输入也会防抖，以降低高清图片和大量 DOM 带来的内存压力。

按住 `Shift` 拖动画布空白区域可以框选多项，`Shift` 点击可以追加或取消单项选择；选中内容后可以按需添加或移除标签，多选时可批量整理。误删内容后可点击提示中的「撤销」，或按 `Command+Z` / `Ctrl+Z` 恢复原位置、尺寸、裁剪和标签。新粘贴的内容不会弹出表单，没有标签时自动出现在「未整理」中；使用过的标签会自动成为顶部快捷筛选入口。标签栏末尾的管理按钮支持重命名、合并、删除和撤销。底部数据库按钮会显示浏览器容量、原图资产、收藏数量和自动备份状态。

顶部标签同时也是子画布入口。进入某个标签后，直接粘贴、拖入或通过加号添加的图片、链接和文字会自动带上当前标签；进入「未整理」时保持无标签，回到「全部」后恢复普通收藏。

运行数据安全验收：

```bash
python3 -m unittest tests/test_backup_recovery.py
```

恢复接口会跳过损坏的 JSON 备份和缺失图片资产的版本，自动寻找最近一份完整备份。

`backups/` 也可以放进 iCloud Drive、Dropbox 或其他同步盘，作为零额外成本的个人备份方式。

例如将自动备份直接写入 iCloud Drive：

```bash
LATER_SPACE_BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Later Space Backups" python3 server.py
```
