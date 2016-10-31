# auth0-guardian-js (beta) [![Build Status](https://travis-ci.com/auth0/auth0-guardian.js.svg?token=yqCyABa23Ae4fxDwqe1c&branch=master)](https://travis-ci.com/auth0/auth0-guardian.js)

UI-less client for Guardian.

## Installation
```javascript
npm install auth0-guardian-js
```

## CDN
Full version
```
https://cdn.auth0.com/js/guardian-js/0.2.0/guardian-js.js
```

Minified version
```
https://cdn.auth0.com/js/guardian-js/0.2.0/guardian-js.min.js
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

- Some steps can be omited depending on the method, we provide the same interface
for all methods so you can write uniform code.
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
			showAuthenticationFor(transaction, payload.enrollment);
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

Some steps can be omited depending on the method, we provide the same interface
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
You can find more information on how to use `auth0-guardian-js` on the [Full API Documentation](/docs/API.md)
