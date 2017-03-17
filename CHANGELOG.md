# Change Log

## [v0.3.0](https://github.com/auth0/auth0-guardian.js/tree/v0.3.0) (2016-12-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v0.3.0...v0.2.5)

**Added**
- Transaction state polling support [\#21](https://github.com/auth0/auth0-guardian.js/pull/21) ([dafortune](https://github.com/dafortune))

## [v0.4.0](https://github.com/auth0/auth0-guardian.js/tree/v0.4.0) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v0.4.0...v0.3.0)

**Added**
- Serialize and resume to guardianJs transactions [\#24](https://github.com/auth0/auth0-guardian.js/pull/24) ([joseluisdiaz](https://github.com/joseluisdiaz))

## [v1.0.0](https://github.com/auth0/auth0-guardian.js/tree/v0.4.0) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.0.0...v0.4.0)

**Added**
- Support manually checking server side state [\#27](https://github.com/auth0/auth0-guardian.js/pull/27) ([dafortune](https://github.com/dafortune)):
  * Manual transaction state checking: call `transaction.getState` to get the state without relying on an open websocket or automatic polling.
  * Know the result of otp code validation (SMS / TOTP) without relying on a socket.
  * Allow to confirm the enrollment after serializing the transaction.

# [v1.0.1](https://github.com/auth0/auth0-guardian.js/tree/v1.0.1) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.0.1...v1.0.0)

**Fix**
- Callback with invalid token error when resuming transaction instead of throwing it.
