import SwiftUI

@main
struct LaterSpaceApp: App {
    @StateObject private var store = CaptureStore.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .task { await store.retryPending() }
        }
    }
}
