import Foundation
import Security

public protocol RefreshTokenStore {
    func load() -> String?
    @discardableResult func save(_ token: String) -> Bool
    @discardableResult func clear() -> Bool
}

public final class KeychainRefreshTokenStore: RefreshTokenStore {
    private let service: String
    private let account: String

    public init(service: String = "VueTraccarCodex", account: String = "mobile_refresh_token") {
        self.service = service
        self.account = account
    }

    public func load() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }

    public func save(_ token: String) -> Bool {
        let data = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let updateStatus = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        if updateStatus == errSecSuccess {
            return true
        }
        if updateStatus != errSecItemNotFound {
            return false
        }
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }

    public func clear() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

public final class InMemoryRefreshTokenStore: RefreshTokenStore {
    private var token: String?
    public init(token: String? = nil) {
        self.token = token
    }
    public func load() -> String? { token }
    public func save(_ token: String) -> Bool {
        self.token = token
        return true
    }
    public func clear() -> Bool {
        token = nil
        return true
    }
}

