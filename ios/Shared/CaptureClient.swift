import Foundation

enum CaptureClient {
    static func send(_ capture: Capture) async throws {
        guard let url = URL(string: SharedSettings.endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/inbox") else {
            throw URLError(.badURL)
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if !SharedSettings.token.isEmpty { request.setValue(SharedSettings.token, forHTTPHeaderField: "X-Later-Space-Token") }
        request.httpBody = try JSONEncoder().encode(capture)
        request.timeoutInterval = 8
        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else { throw URLError(.badServerResponse) }
    }

    static func testConnection() async -> Bool {
        guard let url = URL(string: SharedSettings.endpoint.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/inbox") else { return false }
        var request = URLRequest(url: url)
        if !SharedSettings.token.isEmpty { request.setValue(SharedSettings.token, forHTTPHeaderField: "X-Later-Space-Token") }
        request.timeoutInterval = 5
        guard let (_, response) = try? await URLSession.shared.data(for: request), let http = response as? HTTPURLResponse else { return false }
        return 200..<300 ~= http.statusCode
    }
}
