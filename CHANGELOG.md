# Change Log
# [v1.3.1](https://github.com/auth0/auth0-guardian.js/tree/v1.3.1) (2018-03-27)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.3.0...v1.3.1)

**Fixed**
- `polling` transport stops polling after the first 401 response code is returned.

# [v1.3.0](https://github.com/auth0/auth0-guardian.js/tree/v1.3.0) (2018-02-13)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.3.0...v1.2.0)

**Added**
- `enrollment.getAvailableAuthenticatorTypes()` to replace `enrollment.getAvailableMethods()` [\#47](https://github.com/auth0/auth0-guardian.js/pull/47) ([dafortune](https://github.com/dafortune)).
- `transaction.requestAuth(...)` support for `recovery-code` type (a.k.a. method). Recovery
code can be used the same way as `otp`, `push`, `sms`; it has become its own autenticator type.

**Changed**
- `enrollment.getAvailableMethods()` was deprecated in favor of `enrollment.getAvailableAuthenticatorTypes()` [\#47](https://github.com/auth0/auth0-guardian.js/pull/47) ([dafortune](https://github.com/dafortune)).

## Migration notes:
As an step to support multiple authenticators associated to a single user, since version 1.3.0
recovery code has become its own authenticator type (previously known as method),
this means that we have to allow the user to verify the recovery code as the only authenticator (instead
of solely as a fallback for other authenticator types). Recovery code can be the only authenticator type
if the user removes all the authenticators but the recovery code.

If you are using current Auth0 management API, we prevent you from being affected by this change by keeping the old behavior of the API (the recovery-code authenticator is removed together with the non-recovery authenticators
as it used to be).

There is a case where you could still have recovery code as the only authenticator: when you remove all the other authenticators from guardian app. For this case the API fallbacks to suggest TOTP on `enrollment.getAvailableMethod()`
(deprecated) because that should allow user to enter the recovery code and recover from this condition,
on the other hand `enrollment.getAvailableAuthenticatorTypes()` will suggest that recovery-code
is the only available type.

Since we now support `method: recovery-code` on `.requestAuth`, the suggested approach is to switch
from `enrollment.getAvailableMethods()` to `enrollment.getAvailableAuthenticatorTypes()` to select what method
to use when you start challenge / verification.

# [v1.2.0](https://github.com/auth0/auth0-guardian.js/tree/v1.2.0) (2017-07-18)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.2.0...v1.1.1)

**Added**
- Support path for socket.io URLs [\#38](https://github.com/auth0/auth0-guardian.js/pull/38) ([joseluisdiaz](https://github.com/joseluisdiaz)).


# [v1.1.1](https://github.com/auth0/auth0-guardian.js/tree/v1.1.1) (2017-06-13)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.1.1...v1.1.0)

**Fix**
- Bump dependencies versions (no breaking changes) [\#37](https://github.com/auth0/auth0-guardian.js/pull/37) ([dafortune](https://github.com/dafortune)).

# [v1.0.2](https://github.com/auth0/auth0-guardian.js/tree/v1.0.2) (2017-03-21)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.0.1...v1.0.0)

**Fix**
- Fix uncaught error event thrown even when there is a listener [\#30](https://github.com/auth0/auth0-guardian.js/pull/30) ([dafortune](https://github.com/dafortune)).

# [v1.1.0](https://github.com/auth0/auth0-guardian.js/tree/v1.1.0) (2017-03-22)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.1.0...v1.0.2)

# [v1.0.1](https://github.com/auth0/auth0-guardian.js/tree/v1.0.1) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.0.1...v1.0.0)

**Fix**
- Callback with invalid token error when resuming transaction instead of throwing it [\#29](https://github.com/auth0/auth0-guardian.js/pull/29) ([dafortune](https://github.com/dafortune)).

## [v1.0.0](https://github.com/auth0/auth0-guardian.js/tree/v0.4.0) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v1.0.0...v0.4.0)

**Added**
- Support manually checking server side state [\#27](https://github.com/auth0/auth0-guardian.js/pull/27) ([dafortune](https://github.com/dafortune)):
  * Manual transaction state checking: call `transaction.getState` to get the state without relying on an open websocket or automatic polling.
  * Know the result of otp code validation (SMS / TOTP) without relying on a socket.
  * Allow to confirm the enrollment after serializing the transaction.

## [v0.4.0](https://github.com/auth0/auth0-guardian.js/tree/v0.4.0) (2017-03-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v0.4.0...v0.3.0)

**Added**
- Serialize and resume to guardianJs transactions [\#24](https://github.com/auth0/auth0-guardian.js/pull/24) ([joseluisdiaz](https://github.com/joseluisdiaz))

## [v0.3.0](https://github.com/auth0/auth0-guardian.js/tree/v0.3.0) (2016-12-01)
[Full Changelog](https://github.com/auth0/auth0-guardian.js/compare/v0.3.0...v0.2.5)

**Added**
- Transaction state polling support [\#21](https://github.com/auth0/auth0-guardian.js/pull/21) ([dafortune](https://github.com/dafortune))
