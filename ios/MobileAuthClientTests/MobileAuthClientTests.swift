import XCTest
@testable import MobileAuthClient

private final class MockTransport: HTTPTransport {
    struct Stub {
        let status: Int
        let body: Data
        let path: String
    }

    private let queue = DispatchQueue(label: "mock.transport")
    private var stubs: [Stub] = []
    private(set) var refreshCallCount = 0

    func enqueue(path: String, status: Int, json: String) {
        queue.sync {
            stubs.append(Stub(status: status, body: Data(json.utf8), path: path))
        }
    }

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let url = request.url?.path ?? ""
        if url == "/api/mobile/auth/refresh" {
            queue.sync { refreshCallCount += 1 }
        }
        let stub = queue.sync { stubs.removeFirst() }
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: stub.status,
            httpVersion: "HTTP/1.1",
            headerFields: nil
        )!
        return (stub.body, response)
    }
}

final class MobileAuthClientTests: XCTestCase {
    func test401TriggersSingleRefreshAndRetry() async throws {
        let transport = MockTransport()
        let store = InMemoryRefreshTokenStore(token: "refresh-1")
        let baseURL = URL(string: "https://example.com")!
        let auth = MobileAuthService(baseURL: baseURL, transport: transport, refreshStore: store)
        let api = MobileAPIClient(baseURL: baseURL, transport: transport, auth: auth)

        transport.enqueue(path: "/api/mobile/auth/login", status: 200, json: """
        {"success":true,"accessToken":"a1","exp":9999999999,"refreshToken":"r1","refreshExp":9999999999,"user":"u","role":"user"}
        """)
        _ = try await auth.login(username: "u", password: "p")

        transport.enqueue(path: "/api/travels", status: 401, json: #"{"error":"unauthorized"}"#)
        transport.enqueue(path: "/api/mobile/auth/refresh", status: 200, json: """
        {"success":true,"accessToken":"a2","exp":9999999999,"refreshToken":"r2","refreshExp":9999999999,"user":"u","role":"user"}
        """)
        transport.enqueue(path: "/api/travels", status: 200, json: #"{"ok":true}"#)

        struct Ok: Decodable { let ok: Bool }
        let result: Ok = try await api.request(path: "/api/travels")
        XCTAssertTrue(result.ok)
        XCTAssertEqual(transport.refreshCallCount, 1)
        XCTAssertEqual(store.load(), "r2")
    }

    func testParallel401UsesSingleFlightRefresh() async throws {
        let transport = MockTransport()
        let store = InMemoryRefreshTokenStore(token: "refresh-1")
        let baseURL = URL(string: "https://example.com")!
        let auth = MobileAuthService(baseURL: baseURL, transport: transport, refreshStore: store)
        let api = MobileAPIClient(baseURL: baseURL, transport: transport, auth: auth)

        transport.enqueue(path: "/api/mobile/auth/login", status: 200, json: """
        {"success":true,"accessToken":"a1","exp":9999999999,"refreshToken":"r1","refreshExp":9999999999,"user":"u","role":"user"}
        """)
        _ = try await auth.login(username: "u", password: "p")

        transport.enqueue(path: "/api/travels", status: 401, json: #"{"error":"unauthorized"}"#)
        transport.enqueue(path: "/api/travels", status: 401, json: #"{"error":"unauthorized"}"#)
        transport.enqueue(path: "/api/mobile/auth/refresh", status: 200, json: """
        {"success":true,"accessToken":"a2","exp":9999999999,"refreshToken":"r2","refreshExp":9999999999,"user":"u","role":"user"}
        """)
        transport.enqueue(path: "/api/travels", status: 200, json: #"{"ok":true}"#)
        transport.enqueue(path: "/api/travels", status: 200, json: #"{"ok":true}"#)

        struct Ok: Decodable { let ok: Bool }
        async let first: Ok = api.request(path: "/api/travels")
        async let second: Ok = api.request(path: "/api/travels")
        let values = try await [first, second]
        XCTAssertEqual(values.count, 2)
        XCTAssertEqual(transport.refreshCallCount, 1)
    }

    func testRefreshFailureClearsSession() async throws {
        let transport = MockTransport()
        let store = InMemoryRefreshTokenStore(token: "refresh-1")
        let baseURL = URL(string: "https://example.com")!
        let auth = MobileAuthService(baseURL: baseURL, transport: transport, refreshStore: store)
        let api = MobileAPIClient(baseURL: baseURL, transport: transport, auth: auth)

        transport.enqueue(path: "/api/mobile/auth/login", status: 200, json: """
        {"success":true,"accessToken":"a1","exp":9999999999,"refreshToken":"r1","refreshExp":9999999999,"user":"u","role":"user"}
        """)
        _ = try await auth.login(username: "u", password: "p")

        transport.enqueue(path: "/api/travels", status: 401, json: #"{"error":"unauthorized"}"#)
        transport.enqueue(path: "/api/mobile/auth/refresh", status: 401, json: #"{"error":"unauthorized"}"#)

        struct Ok: Decodable { let ok: Bool }
        do {
            let _: Ok = try await api.request(path: "/api/travels")
            XCTFail("Expected unauthorized")
        } catch {
            XCTAssertNil(store.load())
        }
    }
}
