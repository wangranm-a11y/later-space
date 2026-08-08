import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let queue = CaptureQueue()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let label = UILabel()
        label.text = "正在接住…"
        label.font = .preferredFont(forTextStyle: .headline)
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([label.centerXAnchor.constraint(equalTo: view.centerXAnchor), label.centerYAnchor.constraint(equalTo: view.centerYAnchor)])
        Task { await collectAndFinish(label: label) }
    }

    private func collectAndFinish(label: UILabel) async {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return finish() }
        let captures = await captures(from: items)
        for capture in captures {
            queue.add(capture)
            do {
                try await CaptureClient.send(capture)
                queue.remove(capture.id)
            } catch { }
        }
        label.text = captures.isEmpty ? "没有找到可收藏内容" : "已接住"
        try? await Task.sleep(for: .milliseconds(450))
        finish()
    }

    private func captures(from items: [NSExtensionItem]) async -> [Capture] {
        var captures: [Capture] = []
        for provider in items.flatMap({ $0.attachments ?? [] }) {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier), let value = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier), let url = value as? URL {
                captures.append(Capture(kind: "link", url: url.absoluteString))
            } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier), let value = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier), let data = imageData(from: value) {
                captures.append(Capture(kind: "image", imageData: "data:image/jpeg;base64,\(data.base64EncodedString())", name: "iPhone 分享图片.jpg", mimeType: "image/jpeg"))
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier), let value = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier), let text = value as? String {
                if let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)), ["http", "https"].contains(url.scheme) {
                    captures.append(Capture(kind: "link", url: url.absoluteString))
                } else {
                    captures.append(Capture(kind: "text", text: text))
                }
            }
        }
        return captures
    }

    private func imageData(from value: NSSecureCoding) -> Data? {
        let image: UIImage?
        if let source = value as? UIImage { image = source }
        else if let url = value as? URL { image = UIImage(contentsOfFile: url.path) }
        else { image = nil }
        guard let image else { return nil }
        let maximum: CGFloat = 2400
        let scale = min(1, maximum / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.jpegData(withCompressionQuality: 0.82) { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }

    private func finish() { extensionContext?.completeRequest(returningItems: nil) }
}
