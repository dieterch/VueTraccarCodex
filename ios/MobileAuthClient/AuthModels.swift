import Foundation

public struct MobileLoginRequest: Encodable {
    public let username: String
    public let password: String
}

public struct MobileRefreshRequest: Encodable {
    public let refreshToken: String
}

public struct MobileLogoutRequest: Encodable {
    public let refreshToken: String
}

public struct MobileAuthResponse: Decodable {
    public let success: Bool
    public let accessToken: String
    public let exp: Int
    public let refreshToken: String
    public let refreshExp: Int
    public let user: String
    public let role: String
}

public struct APIErrorResponse: Decodable {
    public let error: String
}

public struct MobileSession: Equatable {
    public let accessToken: String
    public let accessExp: Int
    public let refreshToken: String
    public let refreshExp: Int
}

