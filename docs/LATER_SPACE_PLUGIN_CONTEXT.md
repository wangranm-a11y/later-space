# Later Space 浏览器插件 Context

更新时间：2026-09-03

这份文档沉淀 Later Space 浏览器插件的产品定位、当前能力、技术结构、演进过程和已知问题。新 Codex 对话如需继续开发插件，应先阅读本文件，再查看仓库状态与最近提交。

## 1. 一句话定位

Later Space Collector 是 Later Space 的网页侧轻量入口：用户不必离开当前页面，也不必先填写表单，只需点击、选中或右键，就能先把网页、链接、文字或图片接住。

它解决的不是“怎么建立一个更完整的知识库”，而是缩短从看到内容，到真正使用内容之间的临时存放距离。

## 2. 核心体验原则

- 收藏动作必须比整理动作更轻。
- 不在收藏时强迫用户填写标题、用途、标签或分类。
- 保存反馈要明确，但不能打断阅读。
- 插件只是入口，Later Space 画布才是浏览、编辑和整理的空间。
- 未登录也能使用；登录只负责跨浏览器、跨设备汇合。
- 网络或页面暂时不可用时先排队，不能悄悄丢失内容。
- 小红书、X 等平台抓取失败时优雅降级，不把反爬成功作为硬依赖。

## 3. 当前版本与状态

- 插件名称：`Later Space Collector`
- Manifest：Chrome Manifest V3
- 源码版本：`1.10.5`
- 正式网页：`https://wangranm-a11y.github.io/later-space/`
- 插件源码：`extensions/later-space/`
- 正式安装包内目录：`later-space-chrome-extension/`（固定名称，便于覆盖升级）
- 正式安装包：`dist/later-space-chrome-extension-v1.10.5.zip`

## 4. 用户可见的收藏入口

### 插件弹窗

- 点击浏览器工具栏中的插件图标。
- 主按钮“加入当前网页”保存当前页面 URL 与页面标题。
- 弹窗显示最近一次收藏，可查看或撤销。
- 显示当前保存目的地：本地浏览器或已登录的云端账号。
- 提供“连接 Later Space”“使用指南”“设置”。
- 正常连接时保持轻量；异常时显示原因与“一键修复”，自动唤醒画布、重连并补送待发送内容。

### 快捷键

- macOS：`Control + Shift + L`
- 其他系统：`Alt + Shift + L`
- 保存当前网页。

### 浏览器右键菜单

统一菜单项为“加入 Later Space”，可根据上下文保存：

- 当前网页
- 链接
- 图片
- 选中文字

### 选中文字后的快捷按钮

- 用户完成文字选择后约 `10ms` 出现。
- 按钮跟随选区最后一行右下角，而不是固定在整个选区外框。
- 当前正式样式为 `02 轻盈青苔`：
  - `28px` 暖白圆点
  - 青苔绿色 `+`
  - `+` 由两条对称笔画绘制，避免字体字形造成视觉偏心
  - 悬停变成青苔底、白色 `+`
  - 按下轻微缩小
  - 点击后原位变成白色 `✓`
  - `✓` 稳定停留 `2.4s`，再用 `220ms` 柔和淡出
- 按钮与网页默认蓝色选区形成中性关系，不直接争夺蓝色。
- 使用高优先级行内样式抵抗第三方网页 CSS 污染。

### 图片悬停按钮

在小红书、X、Google 图片、Bing、Pinterest、Reddit 等常见图片页面：

- 大于 `120 x 120` 的图片悬停时显示收藏按钮。
- 图片按钮仍使用完整 Later Space 图标，与文字选区的青苔 `+` 区分。
- 优先抓取图片 URL；抓取失败时退回到当前视口截图并裁出图片区域。
- 图片会缩至最长边不超过 `2400px`，转成 JPEG 后保存。
- 原始远端图片大于 `8MB` 时直接抓取会失败，但截图回退仍可能成功。

## 5. 收藏后的反馈

### 页面内反馈

- 右上角显示“已加入 Later Space”。
- 成功或重复内容显示对勾。
- 有记录 ID 时显示“查看”按钮。
- 查看按钮使用 `16px` 线性 SVG 箭头，位于 `28px` 方形按钮的几何中心；已验证中心偏差为 `0px / 0px`。
- 新收藏在 60 秒内可撤销。
- 提示卡片通常保留 6 秒以容纳撤销操作。

### 声音反馈

- `saved` 和 `duplicate` 播放约 170ms 的轻短双音。
- `queued` 和 `unavailable` 不播放成功音。
- 默认开启，可在设置页关闭。
- 使用 Web Audio API 生成，不依赖额外音频文件。
- 音频失败不会阻塞视觉反馈或收藏结果。

### 回退反馈

- 页面脚本无法接收反馈时，插件尝试重新注入脚本。
- 仍失败时，右键收藏会退回浏览器通知。
- 等待发送的数量通过扩展 badge 显示，最多显示 `99`。

## 6. 保存链路

所有内容进入 `saveCapture()` 前会获得唯一 ID、时间戳和 `source: chrome-extension`，并先写入插件本地队列。这样即使后续链路失败，内容仍有暂存副本。

### 路径 A：已登录，直接写入 Supabase

1. 插件从 `chrome.storage.local` 读取 Later Space 云端 session。
2. access token 临近过期时使用 refresh token 刷新。
3. 链接和文字直接写入 `later_space_items`。
4. 图片先上传私有媒体桶，再写入记录及 `asset_path`。
5. 写入成功后移除队列项。

安全边界：

- 插件只包含公开 anon key。
- 数据隔离依赖 Supabase RLS 与用户 access token。
- `service_role` 密钥绝不能写入插件、网页或仓库。

### 路径 B：未登录，通过 Later Space 网页本地入库

1. 优先复用同一窗口已打开的 Later Space 标签页。
2. 没有页面时，在后台临时打开正式 Later Space。
3. `page-bridge.js` 通过消息桥把收藏交给网页。
4. 网页写入该浏览器自己的 IndexedDB。
5. 最多尝试 15 次，每次间隔 300ms；必要时重新注入桥接脚本。
6. 临时标签完成后关闭。

这意味着未登录用户的数据不会进入公共仓库，也不会被其他用户看到，但清理浏览器站点数据会删除本地收藏。

### 路径 C：失败后进入待发送队列

- 队列位于 `chrome.storage.local`，键名为 `laterSpaceCaptureQueue`。
- 最多保留最近 200 条。
- 每分钟自动重试。
- 浏览器启动、插件安装/更新、重新连接账号时也会触发重试。
- 当前实现按顺序重试，遇到一次发送错误会停止本轮，等待下一次机会。

## 7. 数据类型

### 链接

- `kind: link`
- 保存 URL、页面标题、来源页面和时间。
- 云端记录默认生成编辑版封面数据。
- 后续由 Later Space 页面继续提取标题、生成封面、识别来源和处理重复。

### 文字

- `kind: text`
- 保存选中文本、来源页面和时间。
- 云端默认生成文字卡片数据。
- 页面中的文字选区按钮是当前最轻量的核心交互。

### 图片

- `kind: image`
- 可来自右键 URL、页面悬停按钮或可视区域截图回退。
- 插件端优化尺寸并转为 JPEG。
- 登录后上传云端 Storage；未登录时交给网页 IndexedDB。

### 视频

- Later Space 网页已支持本地视频粘贴与播放。
- 当前浏览器插件尚未直接上传视频文件。
- 网页中的视频封面目前会按图片处理；真正的视频捕获仍是后续能力。

## 8. 撤销、定位与最近收藏

- 成功创建的新记录会注册撤销 token。
- 撤销 token 位于 `chrome.storage.session`，有效期 60 秒。
- 登录状态下撤销会给云端记录写入 `deleted_at`。
- 本地模式下撤销通过 Later Space 页面桥接删除对应记录。
- 最近一次收藏保存在 `laterSpaceLastCapture`，弹窗 24 小时内显示。
- “查看”会激活或打开 Later Space 页面，再发送记录 ID，让画布定位并高亮目标卡片。

## 9. 登录与多设备同步

- 插件不会单独实现登录页，而是打开 Later Space 的同步中心。
- Later Space 网页把 Supabase session 通过受限消息桥交给插件。
- 插件保存 session 后可直接写云端，不需要保持 Later Space 页面开启。
- 未登录时插件仍可通过网页的 IndexedDB 正常使用。
- 登录后会自动重试之前排队的收藏。

## 10. 新手引导

首次安装而非普通更新时，插件自动打开 `welcome.html`。

引导共四个阶段：

1. 真实选中文字并完成一次收藏。
2. 悬停并收藏一张内置练习图片。
3. 认识插件弹窗收藏网页，以及本地和云端的区别。
4. 查看、保留或彻底删除练习内容。

引导进度保存在 `chrome.storage.local`，中途关闭后可以继续。升级不会强制打扰老用户。练习内容带专属标记，可同时从队列、网页本地数据或云端记录中清理。

引导页中的文字练习按钮已同步为正式的 `02 轻盈青苔` 选区按钮。

## 11. 文件结构与职责

- `extensions/later-space/manifest.json`：权限、版本、脚本注入范围、快捷键。
- `extensions/later-space/service-worker.js`：保存编排、云端直写、本地页面桥接、队列、撤销、右键菜单、快捷键、认证和引导状态。
- `extensions/later-space/page-feedback.js`：网页内文字选区按钮、图片悬停按钮、成功提示和查看/撤销入口。
- `extensions/later-space/page-bridge.js`：插件与 Later Space 网页之间的消息桥。
- `extensions/later-space/popup.html` / `popup.js`：工具栏弹窗、当前网页收藏、最近收藏、目的地状态。
- `extensions/later-space/options.html` / `options.js`：连接测试、提示音开关、引导入口。
- `extensions/later-space/welcome.html` / `welcome.js` / `welcome.css`：首次安装的交互式引导。
- `extensions/later-space/feedback-sound.js`：成功提示音。
- `extensions/later-space/icon.svg` 与 PNG：插件图标。
- `extensions/later-space/brand.css`：弹窗、设置、引导中的共享品牌样式。
- `tests/test_extension_onboarding.py`：安装行为、引导、音效、脚本热更新和版本契约。
- `tests/test_extension_selection_affordance.py`：选区位置、响应时间、青苔按钮、完成态和箭头居中契约。
- `docs/extension-icon-playground.html`：插件图标探索 Playground。
- `docs/selection-capture-demo.html`：文字选区按钮的 8 个视觉方向 Playground。
- `docs/superpowers/specs/2026-09-02-extension-onboarding-feedback-design.md`：新手引导与反馈设计。
- `docs/superpowers/plans/2026-09-02-extension-onboarding-feedback-implementation.md`：对应实施计划。
- `dist/`：历史安装包与部分解压目录。

## 12. 插件演进时间线

### 2026-08-09：第一版轻量收藏入口

- 提交：`45f6bfa Add lightweight capture kit`
- 版本：`1.1.0`
- 支持当前网页、链接、图片和选中文字。
- 依赖本地 `127.0.0.1:5177` 服务。
- 已具备右键菜单、快捷键和失败排队雏形。

### 2026-08-16 至 08-18：从“能保存”到“可靠、可感知”

- 调整正式页面连接和插件弹窗。
- 增加页面内成功反馈、查看与 60 秒撤销。
- 修复跨窗口、旧内容脚本、重复图标和发送可靠性。
- 选中文字后出现快捷按钮，并把响应延迟收紧到约 10ms。

关键提交：

- `34cf4d3 Refine extension capture experience`
- `a55c77b Add extension feedback and undo`
- `47f5d75 Harden extension multi-window capture`
- `5cb1b78 Refine extension confirmation and quick capture`
- `bbaf74c Delay selection capture affordance`
- `0ecca63 Prevent stale extension context errors`
- `ee06bb8 Fix extension feedback and capture reliability`
- `578036a Keep selection capture icon singular`

### 2026-08-19：图片收藏覆盖扩大

- 提交：`d5cd401 Improve image capture coverage and connection feedback`
- 针对小红书、X、图片搜索等复杂页面增加图片识别和截图回退。

### 2026-08-23：云端直存

- 登录后不再依赖 Later Space 页面保持开启，插件直接写 Supabase。
- 增加连接引导、排队重试和网页 session 自动同步。

关键提交：

- `1ddf4b2 feat: let extension capture directly to supabase`
- `f56dd6d fix: guide extension cloud connection and retry queued captures`
- `6ca048f feat: auto-sync extension session from Later Space`

### 2026-09-02：引导与品牌

- 修正选区按钮落点，跟随最后一行。
- 加入完整的首次安装交互引导、提示音和练习清理。
- 通过图标 Playground 探索新品牌图形，最终采用青苔绿“接住”图标。

关键提交：

- `239ad75 Improve selection capture icon placement`
- `21d4612 feat: add interactive extension onboarding`
- `5f17f0e Refresh Later Space brand icons`

### 2026-09-03：选区按钮微交互

- 完整 favicon 在文字旁过于突兀，因此独立探索 8 个快捷按钮方向。
- 用户选择 `02 轻盈青苔`。
- 放大为 `28px`，重画居中 `+`，增加悬停反色和 `+ -> ✓`。
- 完成态从 1.4s 延长到 2.4s，并加入 220ms 淡出。
- 右上角查看箭头由文本字符改成居中的线性 SVG。

关键提交：

- `eb36c3e Refine selection capture affordance`
- `f6c50d7 Polish extension feedback timing`

## 13. 历史发布包

`dist/` 中保留了从 `v1.1.0` 到 `v1.9.0` 的多个 zip，以及若干解压目录。这些资产能用于设计过程展示，但不能仅根据文件夹名推断真实内部版本。

已发现的历史问题：

- `dist/later-space-chrome-extension-v1.3.0/` 曾被当作 Ego Lite 的活动目录，内部被覆盖过，不应作为历史发布依据。
- 部分其他历史目录名与其中 `manifest.json` 版本不一致。
- `1.9.6` 使用版本化 zip 和固定的包内目录，避免覆盖升级时因目录改名产生新的扩展实例。

## 14. 当前已知问题与后续优先级

### 发布一致性

- 为每个版本生成干净、命名准确的 zip 和解压目录。
- 不再继续把最新代码覆盖到 `v1.3.0` 历史目录。
- 推送本地尚未上传的插件提交。

### 视觉一致性

- 新手引导中的选区按钮仍是旧视觉，应同步正式 `02` 样式。
- 图片悬停按钮使用完整图标是有意区分，但仍应在更多复杂网页上验证遮挡和对比度。
- 页面反馈卡片可以继续做跨网站 CSS 污染测试。

### 视频入口

- 插件目前不能直接保存视频文件。
- 后续需要明确视频 URL、文件 Blob、社媒视频链接和“只保存封面”之间的边界。
- 大视频需要上传进度、大小限制、失败恢复和云端直传，不能沿用图片 data URL 流程。

### 数据与隐私

- 公开发布前继续验证 RLS、用户隔离、token 刷新和撤销语义。
- 需要明确展示“未登录只在当前浏览器、登录后进入云端”的区别。
- 插件权限较多，包括 `tabs`、`windows`、`scripting` 和广泛 host permissions；正式商店发布时需要解释用途并审视能否收窄。

### 自动化与真实网页覆盖

- 当前测试以源码契约为主，不是完整的浏览器集成测试。
- 应增加跨网页样式污染、选区落点、右键图片回退、登录/未登录、断网排队、撤销和定位的端到端验收。

## 15. 验证命令

```bash
cd /Users/mengwangran/later-space-image-inbox
node --check extensions/later-space/service-worker.js
node --check extensions/later-space/page-feedback.js
node --check extensions/later-space/page-bridge.js
node --check extensions/later-space/popup.js
node --check extensions/later-space/welcome.js
python3 -m unittest tests.test_extension_selection_affordance tests.test_extension_onboarding -v
git diff --check
```

Ego Lite 更新当前活动插件目录：

```bash
rsync -a --delete extensions/later-space/ dist/later-space-chrome-extension-v1.3.0/
```

同步后必须在 `chrome://extensions/` 点击 Later Space Collector 的 Reload，并确认显示版本 `1.10.5`。

## 16. 可用于 HTML 叙事页的真实主线

推荐把故事聚焦在一个很小但很能代表产品判断的问题：

> 一个收藏按钮，怎样出现，才不会打断正在发生的阅读？

叙事结构：

1. **最初目标**：不离开网页，顺手把内容放进 Later Space。
2. **第一版成立**：右键、快捷键、弹窗都能收藏，但反馈和可靠性还不够。
3. **把失败接住**：后台临时页面、云端直存、本地队列、自动重试、撤销和定位逐步补齐。
4. **一个小图标的问题**：完整 favicon 出现在文字旁边太突兀。
5. **真实讨论**：用户提出“青苔小圆点 `+ -> ✓`”，并注意到浏览器蓝色选区与绿色按钮的关系。
6. **Playground 探索**：8 个方案中选择 `02 轻盈青苔`，不是最有装饰感的，而是最不打断正文的。
7. **像素级打磨**：`28px`、居中 `+`、2.4s 完成态、箭头 `0px / 0px` 中心误差、网页 CSS 污染修复。
8. **回到产品定位**：好的收藏工具应该留在思考的边缘，先接住，再把注意力还给用户。

适合保留的真实数字：

- 从 `1.1.0` 到 `1.9.7`
- 约 20 轮插件相关 Git 提交
- 20 多个历史安装包
- 10ms 选区按钮响应
- 28px 收藏圆点
- 2.4s 对勾停留与 220ms 淡出
- 60 秒撤销窗口
- 最多 200 条离线队列
- 每分钟自动重试
- 最多 15 次页面桥接尝试
- 查看箭头几何中心偏差 `0px / 0px`

## 17. 新对话开场提示词

```text
请先读取 /Users/mengwangran/later-space-image-inbox/docs/LATER_SPACE_PLUGIN_CONTEXT.md，再检查仓库当前状态、extensions/later-space/manifest.json 和最近 10 条插件相关提交。我们继续优化 Later Space 浏览器插件。请保持“极轻收藏、先接住、不打断当前阅读”的产品原则，不要回滚工作区其他未提交内容。涉及视觉时先说明方案并获得确认，完成后用 Ego Lite 在真实网页验证。
```
