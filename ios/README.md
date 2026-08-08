# Later Space for iPhone

这是一个本地安装的 SwiftUI App，并包含系统 Share Extension。它不需要上架 App Store。

## 生成工程

1. 从 App Store 安装完整 Xcode。
2. 安装 XcodeGen：`brew install xcodegen`。
3. 在本目录运行 `xcodegen generate`，打开生成的 `LaterSpace.xcodeproj`。
4. 在 Xcode 的 Signing & Capabilities 中，为 `LaterSpace` 和 `LaterSpaceShare` 选择同一个 Personal Team。
5. 两个 Target 都保留 App Group `group.com.stella.laterspace`。如果这个标识被占用，把 Swift、entitlements 和 `project.yml` 中的值一起换成自己的唯一标识。
6. 连接 iPhone，选择设备后运行 LaterSpace。

免费 Apple ID 安装的开发版本通常需要定期重新签名。要长期分发给其他用户，需要 Apple Developer Program 或改用网页/PWA + 快捷指令。

## 使用

1. 打开 Later Space App，填写收件箱服务地址和令牌。
2. 在 Safari、小红书、相册等 App 中点击分享。
3. 选择 Later Space。链接、文字和图片会直接收藏；失败时保存在 App Group 队列，之后打开 App 会自动重试。

本地服务地址必须使用 Mac 的局域网 IP，例如 `http://192.168.1.8:5177`，不能在 iPhone 上填写 `127.0.0.1`。
