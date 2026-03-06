import Foundation

public actor MobileAPIClient {
    private let baseURL: URL
    private let transport: HTTPTransport
    private let auth: MobileAuthService
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    public init(baseURL: URL, transport: HTTPTransport, auth: MobileAuthService) {
        self.baseURL = baseURL
        self.transport = transport
        self.auth = auth
    }

    public func request<T: Decodable, B: Encodable>(
        path: String,
        method: String = "GET",
        body: B? = nil
    ) async throws -> T {
        let token = await auth.currentAccessToken()
        guard let accessToken = token else {
            throw MobileAuthError.unauthorized
        }

        var firstRequest = URLRequest(url: baseURL.appendingPathComponent(path))
        firstRequest.httpMethod = method
        firstRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        firstRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        if let body {
            firstRequest.httpBody = try encoder.encode(body)
        }

        let (firstData, firstResponse) = try await transport.send(firstRequest)
        if firstResponse.statusCode != 401 {
            guard (200...299).contains(firstResponse.statusCode) else {
                throw MobileAuthError.unauthorized
            }
            return try decoder.decode(T.self, from: firstData)
        }

        // Exactly one refresh attempt, then replay original request once.
        let refreshed = try await auth.refresh()
        var retryRequest = firstRequest
        retryRequest.setValue("Bearer \(refreshed.accessToken)", forHTTPHeaderField: "Authorization")

        let (retryData, retryResponse) = try await transport.send(retryRequest)
        if retryResponse.statusCode == 401 {
            await auth.clearSession()
            throw MobileAuthError.unauthorized
        }
        guard (200...299).contains(retryResponse.statusCode) else {
            throw MobileAuthError.unauthorized
        }
        return try decoder.decode(T.self, from: retryData)
    }
}

