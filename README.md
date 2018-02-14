# auth0-guardian-js [![Build Status](https://travis-ci.com/auth0/auth0-guardian.js.svg?token=yqCyABa23Ae4fxDwqe1c&branch=master)](https://travis-ci.com/auth0/auth0-guardian.js)

UI-less client for Guardian.

## Installation
```javascript
npm install auth0-guardian-js
```

## CDN
Full version
```
https://cdn.auth0.com/js/guardian-js/1.3.0/guardian-js.js
```

Minified version
```
https://cdn.auth0.com/js/guardian-js/1.3.0/guardian-js.min.js
```

## Basic Usage

### Configuration
```js
var auth0GuardianJS = require('auth0-guardian-js')({
	// For US tenants: https://{name}.guardian.auth0.com
 	// For AU tenants: https://{name}.au.guardian.auth0.com
 	// For EU tenants: https://{name}.eu.guardian.auth0.com
	serviceUrl: "https://{{ userData.tenant }}.guardian.auth0.com",
	requestToken: "{{ requestToken }}", // or ticket: "{{ ticket }}" - see below

	issuer: {
		// The issuer name to show in OTP Generator apps
		label: "{{ userData.tenantFriendlyName }}",
		name: "{{ userData.tenant }}",
	},

	// The account label to show in OTP Generator apps
	accountLabel: "{{ userData.friendlyUserId }}",

	// Optional, for debugging purpose only,
	// ID that allows to associate a group of requests
	// together as belonging to the same "transaction" (in a wide sense)
	globalTrackingId: "{{ globalTrackingId }}"
});
```
Use of `requestToken` or `ticket` depends on the authentication method. Ticket corresponds to a previously generated  _enrollment ticket_.

### Enrollment
To enroll a device is a process composed of the following steps:

1. Start the transaction
1. (optional) Check if the user is already enrolled. You cannot enroll twice.
1. Send the information needed to enroll
1. Confirm your enrollment
1. Show the recovery code

- Some steps can be omited depending on the method, we provide the same interface
for all methods so you can write uniform code.
- Some of the methods end up completing the authentication, whereas some others need
an extra authentication step. You can know that by listening to the
`enrollment-complete` event.

```js
function enroll(transaction, method) {
	if (transaction.isEnrolled()) {
		console.log('You are already enrolled');
		return;
	}

	var enrollData = {};

	if (method === 'sms') {
		enrollData.phoneNumber = prompt('Phone number'); // Collect phone number
	}

	return transaction.enroll(method, enrollData, function (err, otpEnrollment) {
		if (err) {
			console.error(err);
			return;
		}

		var uri = otpEnrollment.getUri();
		if (uri) {
			showQR(uri);
		}

		var confirmData = {};
		if (method === 'otp' || method === 'sms') {
			confirmData.otpCode = prompt('Otp code'); // Collect verification otp
		}

		otpEnrollment.confirm(confirmData);
	});
}

auth0GuardianJS.start(function(err, transaction) {
	if (err) {
		console.error(err);
		return;
	}

	transaction.on('error', function(error) {
		console.error(error);
	});

	transaction.on('timeout', function() {
		console.log('Timeout');
	});

	transaction.on('enrollment-complete', function(payload) {
		if (payload.recoveryCode) {
			alert('Recovery code is ' + payload.recoveryCode);
		}

		if (payload.authRequired) {
			showAuthenticationFor(transaction, payload.enrollment);
			return;
		}
	});

	transaction.on('auth-response', function(payload) {
		if (payload.recoveryCode) {
			alert('The new recovery code is ' + payload.recoveryCode);
		}

		if (!payload.accepted) {
			alert('Authentication has been rejected');
			return;
		}

		auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
	});

	var availableEnrollmentMethods = transaction.getAvailableEnrollmentMethods();

	method = prompt('What method do you want to use, select one of '
		+ availableEnrollmentMethods.join(', '));

	enroll(transaction, method) // For sms
});
```

### Authentication
To authenticate with a method you need to execute the following steps

1. Start the transaction
1. (optional) Check if the user is already enrolled. You need to be enrolled to
authenticate.
1. Request the auth (the push notification / sms). Request is a noop for OTP
1. Verify the otp (`.verify` is a noop for push)

Some steps can be omitted depending on the method, we provide the same interface
for all methods so you can write uniform code.
After the factor is verified or the push accepted you will receive an
`auth-response` event with the payload to send to the server, you can
use the `auth0GuardianJS.formPostHelper('{{ postActionURL }}', payload)` to
post back the message to the server.

You may also receive `auth-rejected` if the push notification was received.

```js
function authenticate(method) {
	auth0GuardianJS.start(function (err, transaction) {
		if (err) {
			console.error(err);
			return;
		}

		if (!transaction.isEnrolled()) {
			console.log('You are not enrolled');
			return;
		}

		transaction.on('error', function(error) {
			console.error(error);
		});

		transaction.on('timeout', function() {
			console.log('Timeout');
		});

		transaction.on('auth-response', function(payload) {
			if (payload.recoveryCode) {
				alert('The new recovery code is ' + payload.recoveryCode);
			}

			if (!payload.accepted) {
				alert('Authentication has been rejected');
				return;
			}

			auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
		});

		var enrollment = transaction.getEnrollments()[0];

		if (enrollment.getAvailableAuthenticatorTypes().length === 0) {
			alert('Somethings went wrong, seems that there is no authenticators');
			return;
		}

		transaction.requestAuth(enrollment, { method: method } function(err, auth) {
			if (err) {
				console.error(err);
				return;
			}

			var data = {};
			if (method === 'sms' || method === 'otp') {
				data.otpCode = prompt('Otp code');
			} else if (method === 'recovery-code') {
				data.recoveryCode = prompt('Recovery code');
			}

			return auth.verify(data);
		});
	});
}
```

### Recovery
**DEPRECATED:** This method has been deprecated and its usage is discouraged,
use `.requestAuth` with method recovery-code (if available) instead.

Recovery works as authentication, but instead of passing an `otpCode`, you need
to pass a `recoveryCode` to verify method

```js
auth0GuardianJS.start(function(err, transaction) {
	if (err) {
		console.error(err);
		return;
	}

	transaction.on('error', function(error) {
		console.error(error);
	});

	transaction.on('timeout', function() {
		console.log('Timeout');
	});

	transaction.on('auth-response', function(payload) {
		if (payload.recoveryCode) {
			alert('The new recovery code is ' + payload.recoveryCode);
		}

		if (!payload.accepted) {
			alert('Authentication has been rejected');
			return;
		}

		auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
	});

	if (!transaction.isEnrolled()) {
		console.log('You are not enrolled');
		return;
	}

	var recoveryData = {};
	recoveryData.recoveryCode = prompt('Recovery code'); // Collect recovery code

	return transaction.recover(recoveryData);
});
```

## Full API
First of all you need to instantiate the library

```javascript
const auth0GuardianJS = require('auth0-guardian-js')({
	requestToken: //...,
	serviceUrl: //...,
	issuer: {
		name: //...,
		label: //...
	},
	accountLabel: //...
});
```

### auth0GuardianJS.start(callback)
Starts a transaction on Guardian, callbacks with an error (if any)
or a transaction ready to be used.

A transaction holds the current state of the operations being executed
in Guardian and provides a bound point to listen to events and execute further
operations.

```js
auth0GuardianJS.start(function(err, transaction) {
  //...
});
```
### auth0GuardianJS.resume(options, transactionState, callback)
This continues a transaction saved by `transaction.serialize()`. The options parameter provides
the library user the opportunity to specify which kind of `transport` to use. Options include:

- `socket`: a socket.io transport
- `polling`: a polling transport.

If not set, the `socket` transport is used as default

This is a factory method, you SHOULD NOT instantiate`auth0GuardianJS`.

at some point in your code you stored the transaction:
```js
auth0GuardianJS.start(function(err, transaction) {
  //...

  secureStorage.store('guardiantx', transaction.serialize());
});
```

Later, in another part of the code:
```js
var serializedTransaction = secureStorage.get('guardiantx');

auth0GuardianJS.resume({ transport: 'polling' }, serializedTransaction, function(err, transaction) {
  //... continue using that transaction object.
});

```

### Transaction

#### transaction.isEnrolled()
Returns `true` if user is already enrolled, false otherwise.

```js
transaction.isEnrolled();
```

#### transaction.getAvailableEnrollmentMethods()
Returns an array of strings that represent the available enrollment methods,
they are the methods that are currently available for you to enroll with.

The supported methods right now are:
- `otp`: One time password manual input (e.g. Google Authenticator)
- `sms`: SMS based otp, you will get an SMS as a second factor
- `push`: Push notifications, you will get a push notification that you have to
accept to confirm your identity.

```js
transaction.getAvailableEnrollmentMethods();
```

#### transaction.getAvailableAuthenticationMethods()
**DEPRECATED:** Use `.getAvailableAuthenticatorTypes()` from the enrollment instead.

Returns an array of strings that represent the available authentication methods,
they are the methods that are currently available for you to authenticate with.

The supported methods right now are:
- `otp`: One time password manual input (e.g. Google Authenticator)
- `sms`: SMS based otp, you will get an SMS as a second factor
- `push`: Push notifications, you will get a push notification that you have to
accept to confirm your identity.

```js
transaction.getAvailableAuthenticationMethods();
```

#### transaction.getEnrollments()
Returns an array current user's enrollments objects, right now it will return
single enrollment if user is enrolled, or no enrollment is user is not enrolled.

```js
var enrollments = transaction.getEnrollments();
```
#### transaction.enroll(data, callback)
Starts an enrollment, this method is only valid when the user is not enrolled
and there is at least an enrollment method available; otherwise it will return an
error. It receives the data needed to enroll which is different depending on the
method you want to use (see below) and callbacks with an error if it has been rejected
or an `enrollmentFlow` if it has been accepted.

Enrollment data:
- For sms:
	- `phoneNumber`: the phone number as a single international string

- For push and otp: no data needed. You can pass `null` / `undefined` or an empty object.

```js
var data = // Depends on the method
// data.phoneNumber for sms
// the other methods don't require extra data

transaction.enroll(data, function(err, enrollmentFlow) {

})
```

#### transaction.requestAuth(enrollment, [{ method: string }], callback)
Starts authentication, this method is only valid if user is enrolled and there is
at least one authentication method available for this transaction and the enrollment
(otherwise, will callback with an error). It receives the enrollment and optionally
the method you want to enroll (otherwise the first one available on the
enrollment will be used) and callbacks with an error or the authFlow. As result
of this methods `auth-response` or `error` could be triggered.

```js
transaction.requestAuth(enrollments[0], { method: enrollment.getAvailableMethods()[0] }, function(err, authFlow) {
	if (err) {
		// ...
	}

	var data = // otpCode for sms or otp; none for push
	authFlow.verify(data)
});
```
#### transaction.recover({ recoveryCode: string })
**DEPRECATED:** This method has been deprecated and its usage is discouraged,
use `.requestAuth` with method `recovery-code` (if available) instead.

Authenticates using a recovery code, receives the recovery code as an string
with just alpha numeric characters (no separators, etc.) as result of this
method an `error` or `auth-response` error could be emitted; in case of
`auth-response` it will include `.recoveryCode` as part of the payload, that
recovery code is the new recovery code you must show to the user from him to save it.

```js
transaction.recover({ recoveryCode: recoveryCode });
```

#### transaction.serialize()
The .serialize() method creates a plain javascript Object that should remain opaque
to the library user. This must be stored by the user in a secure way.

This object is used in combination with `auth0GuardianJS.resume`

#### transaction.on(eventName, handler)
Listen for `eventName` and execute the handler if that event is received. The
handler might include a payload with extra information about the event.

##### Events
###### enrollment-complete
Emitted when the enrollment has been completed; you could receive this event
even when you have not started an enrollment from this transaction. In such
case `recoveryCode` won't be available and it means that enrollment has been
completed in a different transaction (for example in another tab), you should
show authentication (`authRequired` will be true).

```javascript
transaction.on('enrollment-complete', function ({ authRequired, recoveryCode, enrollment }) {
	// Enrollment confirmed

	// authRequired will be true if the enrollment methods require authentication

	// recoveryCode will be available only in case that the enrollment has been started from
	// the current transaction, you should show it for the user to write it down.

	// enrollment the shinny new enrollment, use it to authenticate if authRequired
	// is true
});
```

###### auth-response
Emitted when an authentication have been accepted or rejected. SMS and OTP enrollments
also trigger this event since after those enrollments you are assumed to be
authenticated; push enrollment doesn't trigger it and you should start the
normal auth flow instead after enrollment.
If there is an active enrollment in the current transaction, `auth-response` is
guaranteed to be triggered after `enrollment-complete`.

```js
transaction.on('auth-response', function({ accepted, recoveryCode, signature }) {
	// Auth response
	//
	// accepted: true if the authentication has been accepted, false otherwise
	//
	// signature: data to post to the verifier server for it to verify the transaction
	//  it is only available if the transaction has been accepted
	//
	// recoveryCode: only available after recovery, it is the new recovery code the
	// user should save securely.
});
```

###### timeout
Emitted when the transaction is no longer valid, you cannot enroll or authenticate. You should
start a new transaction.

transaction.on('timeout', function () {
	// Transaction time out
});

###### error
Emitted when there is an error on the transaction

```
transaction.on('error', function(error /* instanceOf GuardianError */) {
	// Errors that cannot be associated to a particular action, like socket.io errors or so
});
```

### EnrollmentFlow
Let you confirm and execute operations on a not-yet-confirmed enrollment.

#### enrollmentFlow.getUri()
Returns the enrollment URI for methods that support uri-based enrollments (push and otp),
this URI is usually presented as a QR code. It is a noop that returns `null` for
for methods that don't support URI-based enrollment.

#### enrollmentFlow.getData()
Returns the enrollment data for methods that to transfer some data between devices in
order to enroll (such as push and otp). This data could be used to generate the enrollment
uri to show in a QR but since this is a common use case we provide `enrollmentFlow.getUri()`
as a convenience method. The main use case for this data is when you want to use a
different way to transfer the data instead of a QR code.
For methods that don't need to transfer any data (such as sms)
it is a noop that returns `null`.

The data includes the following fields:
```js
{
  issuerLabel: // Issuer label
  otpSecret: // Base 64 encoded otp secret
  enrollmentTransactionId: // Transaction id to start enrollment exchange
  issuerName: // Issuer 'unique' name
  enrollmentId: // Id of current enrollment (pending confirmation)
  baseUrl: // Base url for mobile app
  algorithm: // Algorithm for otp generation
  digits: // Number of digits for otp generation
  counter: // Counter for otp generation
  period: // Duration of each otp code
}

```

#### enrollmentFlow.confirm(data)
Confirms the enrollment, an enrollment is not considered valid until it is
confirmed the data needed to confirm the enrollment depends on the method (see below).
As result of this method, `error` or `enrollment-complete` events can be fired.

Enrollment confirmation data:
- For SMS:
	- `otpCode`: The otp code sent by sms to the phone number specified on the first step of enrollment.
- For OTP:
	- `otpCode`: An otp code get from otp generator app (e.g. Google Authenticator)
- For Push: No data needed, the enrollment is confirmed by the cell phone; you can
omit this step but it is provided as a noop so you can write uniform code.

### Auth Flow

#### authFlow.verify(data)
Let you verify the authentication by providing the verification data (see below).
Push notfication does need this because the confirmation is done on the cell phone.

Auth verification data:
- For SMS:
	- `otpCode`: The otp code sent by sms to the phone number specified on the first step of enrollment.
- For OTP:
	- `otpCode`: An otp code get from otp generator app (e.g. Google Authenticator)
- For Push: No data needed, the auth is verified by accepting the push notification on your
cell phone; you can omit this step but it is provided as a noop so you can write uniform code.

### authFlow.getMethod()
Returns the method associated with current auth flow; it might be sms, otp or push.

### Enrollment

#### enrollment.getAvailableMethods()
**DEPRECATED:** Use `.getAvaialbeAuthenticatorTypes` instead. This method does not
includes recovery authenticator which has become its own specific authenticator type.

Returns an array of strings that represent the authentication methods that can
be used for this enrollment in the current transaction (the available methods
might change from transaction to transaction). They depends on the methods supported
by the enrollment and the methods currently allowed by the tenant.

```js
enrollments[i].getAvailableMethods();
```

#### enrollment.getMethods()
Returns an array of strings that represent the authentication methods associated
with this enrollments, they are the only methods that (if available for this transaction)
can be used to authenticate the user based on the given enrollment.

```js
enrollments[i].getMethods();
```

#### enrollment.getAvailableAuthenticatorTypes()
Returns an array of strings that represent the authenticator types (that used to
be called methods) that can be used for this enrollment in the current transaction
(the available types might change from transaction to transaction). They depend on
the types supported by the enrollment and the methods currently allowed by the tenant.

#### enrollment.getName()
Returns the device name associated with the enrollment, this is a name you can
show to the user; and it might be used to identify the device in an user-friendly
way. This name is only available for push notification enrollments.

#### enrollment.getPhoneNumber()
Returns the phone number associated with the enrollment. This number will be masked
and it is only meant to be used as a way for the user to identify the device that
will receive the SMS.

### Error object and error codes
Every error you can get from the api (callback error or `error` event) is an instance
of `Error` and have the following format:

```js
{
	message: string, // English message, description of the error
	errorCode: string // Unique identifier or the error
	statusCode: number // For http requests: http status code
}
```

## Error codes
The error codes may (and should) be used to display informative messages and to
distinguish between recoverable and unrecoverable errors. This is a list of
the errors codes and its meaning

| Error Code | Description |
|------------|-------------|
| invalid_token | Invalid request or transaction token |
| insufficient_scope | You don't have enought grants to perform the requested operation |
| invalid_bearer_format | The bearer put in `authentication` header was not valid |
| enrollment_conflict | There is another enrollment for the same user. You cannot enroll twice. |
| tenant_not_found | The tenant associated cannot be found. Should not normally hapen at least that you delete the tenant |
| login_transaction_not_found | The mfa auth transaction is not active or has already expired |
| error_sending_push_notification | Push notification delivery failed |
| push_notification_wrong_credentials | Push notification delivery failed because of wrong credentials |
| invalid_otp | Provided otp code was not valid |
| invalid_recovery_code | Provided recovery code was not valid |
| invalid_body | Body validation failed. Bad request. |
| invalid_query_string | Query string validation failed. Bad request. |
| enrollment_transaction_not_found | The mfa enrollment transaction is not active or has expired |
| invalid_phone_number | The provided phone number is invalid |
| error_sending_sms | SMS Delivery error |
| feature_disabled | The requested feature is currently globally not available (contact the provider) |
| feature_disabled_by_admin | The requested feature is currently disabled by your admin |
| pn_endpoint_disabled | We were unable to deliver the push notification after retrying many times. Try removing you account for the device and adding it again. |
| too_many_sms | You have exeed the amount of SMSs assigned to your user |
| too_many_pn | You have exeed the amount of push notifications assigned to your user |
| too_many_sms_per_tenant | You have exeed the amount of SMSs assigned to your tenant |
| too_many_pn_per_tenant | You have exeed the amount of push notifications assigned to your tenant |
| field_required | A field is required to perform the operation (this errors has a `field` attribute with a code for the field: `otpCode`, `recoveryCode`) |
| method_not_found | You have requested a method that is currently not supported (should not happen) |
| no_method_available | There is currently no method to enroll (all of them are disabled) |
| enrollment_method_disabled | The specified enrollment method is disabled, this error has also a `.method` field |
| auth_method_disabled | The specified authentication method is disabled, this error has also a `.method` field |
| invalid_otp_format | Otp format validation error |
| invalid_recovery_code_format | Recovery code format validation error |
| transaction_expired | The transaction has already expired |
| already_enrolled | You are already enrolled, cannot enroll again |
| not_enrolled | You not enrolled. Must enroll first |
| invalid_enrollment | The enrollment provided to `transaction#requestAuth` method is not valid or is null/undefined |
