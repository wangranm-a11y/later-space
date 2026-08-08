import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: CaptureStore
    @AppStorage("captureEndpoint", store: SharedSettings.defaults) private var endpoint = "http://127.0.0.1:5177"
    @AppStorage("captureToken", store: SharedSettings.defaults) private var token = ""
    @State private var testState = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("待发送") {
                        Text("\(store.pendingCount)")
                            .foregroundStyle(store.pendingCount == 0 ? .secondary : .primary)
                    }
                    Button("立即重试", systemImage: "arrow.clockwise") {
                        Task { await store.retryPending() }
                    }
                    .disabled(store.pendingCount == 0 || store.isSending)
                } header: {
                    Text("收件箱")
                } footer: {
                    Text("从任意 App 点击分享，选择 Later Space。发送失败的内容会留在本机，之后自动重试。")
                }

                Section("连接") {
                    TextField("服务地址", text: $endpoint)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)
                    SecureField("收集令牌（选填）", text: $token)
                    Button("测试连接", systemImage: "bolt.horizontal") {
                        Task { testState = await CaptureClient.testConnection() ? "连接成功" : "暂时无法连接" }
                    }
                    if !testState.isEmpty { Text(testState).foregroundStyle(.secondary) }
                }

                Section("使用") {
                    Label("在 Safari、小红书、相册等 App 中打开分享菜单", systemImage: "square.and.arrow.up")
                    Label("选择 Later Space，内容会被直接接住", systemImage: "checkmark.circle")
                    Label("标题、标签和整理留到之后再做", systemImage: "rectangle.3.group")
                }
            }
            .navigationTitle("Later Space")
        }
    }
}
