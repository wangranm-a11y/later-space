import Foundation

struct Capture: Codable, Identifiable {
    let id: String
    let kind: String
    var url: String?
    var text: String?
    var imageData: String?
    var name: String?
    var mimeType: String?
    var title: String?
    var source: String
    var pageUrl: String?
    let createdAt: Int64

    init(kind: String, url: String? = nil, text: String? = nil, imageData: String? = nil, name: String? = nil, mimeType: String? = nil, title: String? = nil, source: String = "ios-share", pageUrl: String? = nil) {
        self.id = UUID().uuidString
        self.kind = kind
        self.url = url
        self.text = text
        self.imageData = imageData
        self.name = name
        self.mimeType = mimeType
        self.title = title
        self.source = source
        self.pageUrl = pageUrl
        self.createdAt = Int64(Date().timeIntervalSince1970 * 1000)
    }
}

enum SharedSettings {
    static let appGroup = "group.com.stella.laterspace"
    static let defaults = UserDefaults(suiteName: appGroup)!
    static var endpoint: String { defaults.string(forKey: "captureEndpoint") ?? "http://127.0.0.1:5177" }
    static var token: String { defaults.string(forKey: "captureToken") ?? "" }
}
