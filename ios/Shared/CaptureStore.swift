import Combine
import Foundation

@MainActor
final class CaptureStore: ObservableObject {
    static let shared = CaptureStore()
    @Published private(set) var pendingCount = 0
    @Published private(set) var isSending = false

    private let queue = CaptureQueue()

    private init() { pendingCount = queue.pending().count }

    func retryPending() async {
        guard !isSending else { return }
        isSending = true
        for capture in queue.pending() {
            do {
                try await CaptureClient.send(capture)
                queue.remove(capture.id)
            } catch { break }
        }
        pendingCount = queue.pending().count
        isSending = false
    }
}

final class CaptureQueue {
    private var directory: URL {
        let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: SharedSettings.appGroup)!
        let folder = root.appendingPathComponent("CaptureQueue", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    func add(_ capture: Capture) {
        guard let data = try? JSONEncoder().encode(capture) else { return }
        try? data.write(to: directory.appendingPathComponent("\(capture.id).json"), options: .atomic)
    }

    func pending() -> [Capture] {
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.compactMap { try? JSONDecoder().decode(Capture.self, from: Data(contentsOf: $0)) }.sorted { $0.createdAt < $1.createdAt }
    }

    func remove(_ id: String) { try? FileManager.default.removeItem(at: directory.appendingPathComponent("\(id).json")) }
}
