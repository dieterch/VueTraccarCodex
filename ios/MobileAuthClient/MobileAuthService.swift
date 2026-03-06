import Foundation

public enum MobileAuthError: Error {
    case unauthorized
    case invalidResponse
}

public protocol HTTPTransport {
    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public final class URLSessionTransport: HTTPTransport {
    private let session: URLSession
    public init(session: URLSession = .shared) {
        self.session = session
    }
    public func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw MobileAuthError.invalidResponse
        }
        return (data, http)
    }
}

public actor MobileAuthService {
    private let baseURL: URL
    private let transport: HTTPTransport
    private let refreshStore: RefreshTokenStore
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private var session: MobileSession?
    private var inflightRefresh: Task<MobileSession, Error>?

    public init(baseURL: URL, transport: HTTPTransport, refreshStore: RefreshTokenStore) {
        self.baseURL = baseURL
        self.transport = transport
        self.refreshStore = refreshStore
    }

    public func login(username: String, password: String) async throws -> MobileSession {
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/mobile/auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(MobileLoginRequest(username: username, password: password))

        let (data, response) = try await transport.send(request)
        guard response.statusCode == 200 else {
            throw MobileAuthError.unauthorized
        }
        let payload = try decoder.decode(MobileAuthResponse.self, from: data)
        let next = MobileSession(
            accessToken: payload.accessToken,
            accessExp: payload.exp,
            refreshToken: payload.refreshToken,
            refreshExp: payload.refreshExp
        )
        _ = refreshStore.save(next.refreshToken)
        session = next
        return next
    }

    public func currentAccessToken() -> String? {
        session?.accessToken
    }

    public func refresh() async throws -> MobileSession {
        if let task = inflightRefresh {
            return try await task.value
        }

        let task = Task<MobileSession, Error> { [baseURL, transport, refreshStore, encoder, decoder] in
            guard let refreshToken = refreshStore.load(), !refreshToken.isEmpty else {
                throw MobileAuthError.unauthorized
            }

            var request = URLRequest(url: baseURL.appendingPathComponent("/api/mobile/auth/refresh"))
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(MobileRefreshRequest(refreshToken: refreshToken))

            let (data, response) = try await transport.send(request)
            guard response.statusCode == 200 else {
                _ = refreshStore.clear()
                throw MobileAuthError.unauthorized
            }
            let payload = try decoder.decode(MobileAuthResponse.self, from: data)
            let next = MobileSession(
                accessToken: payload.accessToken,
                accessExp: payload.exp,
                refreshToken: payload.refreshToken,
                refreshExp: payload.refreshExp
            )
            _ = refreshStore.save(next.refreshToken)
            return next
        }

        inflightRefresh = task
        do {
            let next = try await task.value
            session = next
            inflightRefresh = nil
            return next
        } catch {
            clearSession()
            inflightRefresh = nil
            throw error
        }
    }

    public func logout() async {
        guard let refreshToken = refreshStore.load(), !refreshToken.isEmpty else {
            clearSession()
            return
        }
        var request = URLRequest(url: baseURL.appendingPathComponent("/api/mobile/auth/logout"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? encoder.encode(MobileLogoutRequest(refreshToken: refreshToken))
        _ = try? await transport.send(request)
        clearSession()
    }

    public func clearSession() {
        session = nil
        _ = refreshStore.clear()
    }
}
