# auth0-guardian-js [![Build Status](https://travis-ci.com/auth0/auth0-guardian.js.svg?token=yqCyABa23Ae4fxDwqe1c&branch=master)](https://travis-ci.com/auth0/auth0-guardian.js)

UI-less client for Guardian, it works both on the client and on the server side, regarding server side opening
a websocket is not advisable so we will provide some configurations to avoid this behavior for the modes
that don't need it (all factors but push notifications).

## Installation
```javascript
npm install auth0-guardian-js
```
## Basic Usage

### Configuration
```js
var auth0GuardianJS = require('auth0-guardian-js')({
	// For US: https://{name}.guardian.auth0.com
 	// For AU: https://{name}.au.guardian.auth0.com
 	// For EU: https://{name}.eu.guardian.auth0.com
	serviceUrl: "https://{{ userData.tenant }}.guardian.auth0.com", // {name}.guardian.auth0.com
	requestToken: "{{ requestToken }}",

	issuer: {
		label: "{{ userData.friendlyUserId }}",
		name: "{{ userData.tenant }}",
	}
});
```

### Enrollment
To enroll a device is a process composed of the following steps:

1. Start the transaction
1. (optional) Check if the user is already enrolled. You cannot enroll twice.
1. Send the information needed to enroll
1. Confirm your enrollment
1. Show the recovery code

- Some steps can be ommited depending on the method, we provide the same interface
for all method so you can write an uniform code.
- Some of the methods end up completing the authentication, whereas some others need
an extra authentication step. You can know that by listening to the
`enrollment-complete` event.

```js
function enroll(transaction, method) {
	if (transaction.isEnrolled()) {
		console.log('You are already enrolled');
		return undefined;
	}

	var enrollData = {};

	if (method === 'sms') {
		enrollData.phoneNumber = prompt('Phone number'); // Collect phone number
	}

	return transaction.enroll(method, enrollData, function (err, otpEnrollment) {
		if (err) {
			console.error(err);
			return undefined;
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
		return undefined;
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
			showAuthentication();
			return undefined;
		}
	});

	transaction.on('auth-response', function(payload) {
		if (payload.recoveryCode) {
			alert('The new recovery code is ' + payload.recoveryCode);
		}

		if (!payload.accepted) {
			alert('Authentication has been rejected');
			return undefined;
		}

		auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
	});

	var availableEnrollmentMethods = transaction.getAvailableEnrollmentMethods();

	method = prompt('What method do you want to use, select on of '
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

Some steps can be ommited depending on the method, we provide the same interface
for all methods so you can write an uniform code.
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
			return undefined;
		}

		if (!transaction.isEnrolled()) {
			console.log('You are not enrolled');
			return undefined;
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
				return undefined;
			}

			auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
		});

		var enrollment = transaction.getEnrollments()[0];

		transaction.requestAuth(enrollment, { method: method } function(err, auth) {
			if (err) {
				console.error(err);
				return undefined;
			}

			var data = {};
			if (method === 'sms' || method === 'otp') {
				data.otpCode = prompt('Otp code');
			}

			return auth.verify(data);
		});
	});
}
```

### Recovery
Recovery works as authentication, but instead of passing an otpCode, you need
to pass a recovery code to verify method

```js
auth0GuardianJS.start(function(err, transaction) {
	if (err) {
		console.error(err);
		return undefined;
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
			return undefined;
		}

		auth0GuardianJS.formPostHelper('{{ postActionURL }}', { signature: payload.signature });
	});

	if (!transaction.isEnrolled()) {
		console.log('You are not enrolled');
		return undefined;
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
		friendlyName: //...
	}
});
```

Then start the transaction
```js
auth0GuardianJS.start(function(err, transaction) {
  //...
});
```

You can ask if the user is enrolled
```js
transaction.isEnrolled();
```

Get enrollments
```js
var enrollments = transaction.getEnrollments();
```

Ask which methods are available
```js
enrollments.getAvailableMethods();
```

Assuming that the user is not enrolled and that there is at least a method enabled
you can start the enrollment
```js
var data = // Depends on the method
// data.phoneNumber for sms
// the other methods don't require extra data

transaction.enroll(data, function(err, enrollmentFlow) {

})
```

Or if the user is already enrolled and there is at least one factor enabled
you can request auth
```js
transaction.requestAuth(enrollments[0], { method: enrollment.getAvailableMethods()[0] }, function(err, authFlow) {
	if (err) {
		// ...
	}

	var data = // otpCode for sms or otp; none for push
	authFlow.verify(data)
});
```

Recovery
```js
transaction.recover({ recoveryCode: recoveryCode });
```

You should wait for `auth-response` event for all authentication methods;

### Events
#### enrollment-complete
Emitted when the enrollment has been completed; you could receive this event
even when you have not started an enrollment from this transaction. In such
case `recoveryCode` won't be available and it means that enrollment has been
completed in a different transaction (for example in another tab), you should
show authentication (`authRequired` will be true).

```javascript
transaction.on('enrollment-complete', function ({ authRequired, recoveryCode }) {
	// Enrollment confirmed

	// authRequired will be true if the enrollment methods require authentication

	// recoveryCode will be available only in case that the enrollment has been started from
	// the current transaction, you should show it for the user to write it down.
});
```

#### auth-response
Emitted when an authentication have been accepted or rejected. SMS and OTP enrollments
also trigger this event since after those enrollments you are assumed to be
authenticated; push enrollment doesn't trigger it and you should start the
normal auth flow instead after enrollment.

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

### timeout
Emitted when the transaction is no longer valid, you cannot enroll or authenticate. You should
start a new transaction.

transaction.on('timeout', function () {
	// Transaction time out
});

### error
Emmited when there is an error on the transaction

transaction.on('error', function(error /* instanceOf GuardianError */) {
	// Errors that cannot be associated to a particular action, like socket.io errors or so
});
```
