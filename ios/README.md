# iOS Mobile Auth Reference

This folder contains a drop-in Swift reference for mobile auth against this backend:

- `POST /api/mobile/auth/login`
- `POST /api/mobile/auth/refresh`
- `POST /api/mobile/auth/logout`

Included:
- `MobileAuthService` with refresh-token rotation support
- `KeychainRefreshTokenStore` for secure refresh-token storage
- `MobileAPIClient` with one-time auto-refresh on `401`
- Single-flight refresh logic to avoid parallel refresh storms
- XCTest examples in `ios/MobileAuthClientTests/`

Usage in Xcode:
1. Copy `ios/MobileAuthClient/*.swift` into your app target.
2. Copy `ios/MobileAuthClientTests/*.swift` into your test target.
3. Replace `baseURL` with your deployment host.
4. Wire login/logout to UI flows.

