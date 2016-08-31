# guardian.js

UI-less client for Guardian, it works both on the client and on the server side, regarding server side opening
a websocket is not advisable so we will provide some configurations to avoid this behavior for the modes
that don't need it (all factos but push notifications).

The client should work for enrollment and for authenticator and supporting future feature must be kept
in mind when designing it.

Regarding naming, we will try to use new names as much as posible instead of the old ones,
even when the backend api still uses the old names.

## Installation
```javascript
	npm install guardian.js
```

## Usage
First of all you need to instantiate the library

```javascript
	const GuardianJS = require('guardian-js');
	const guardian = new GuardianJS({
		requestToken: //...,
		serviceDomain: //...,
		tenant: {
			name: //...,
			friendlyName: //...
		}
	});
```

Then start the login transaction
```javascript
	guardian.start()
		.then(transaction => {
			//...
		});
```

You can ask if the user is enrolled
```javascript
	transaction.isEnrolled();
```

You can also ask if the user CAN enrolled
```javascript
	transaction.canEnroll();
```

Finally you can ask if there is any factor enabled
```javascript
	transaction.isAnyFactorEnabled();
```

Assuming that the user can enroll and that there is at least a factor enabled
you can start the enrollment flow
```javascript
	const enrollmentFlow = transaction.startEnrollment();
```

Or if the user is already enrolled and there is at least one factor enabled
you can start the auth flow
```javsacript
	const authFlow = transaction.startAuth();
```

### Events
```javascript
guardian.events.on('enrollment-complete', function() {
	// Enrollment confirmed
});

guardian.events.on('auth-complete', function({ loginToken }) {
	// Enrollment confirmed
});

guardian.events.on('transaction-timeout', function() {
	// Transaction time out
});

guardian.events.on('error', function(error /* instanceOf GuardianError */) {
	// Errors that cannot be associated to a particular action, like socket.io errors or so
});
```

### Enrollment flow
Getting available factors
```javascript
	enrollmentFlow.getAvailableFactors();
```

Initializing an enrollment with a factor
```javascript
	const smsEnrollment = enrollmentFlow.forFactor('sms');
	const authenticatorEnrollment = enrollmentFlow.forFactor('authenticator');
	const pushNotificationEnrollment = enrollmentFlow.forFactor('pushNotification');
```

Getting the recovery code
```javascript
	enrollmentFlow.getRecoveryCode();
```

#### SMS enrollment
Enroll a phone number
```javascript
	smsEnrollment.enroll({ phoneNumber: '+54 93416751599' })
		.then(() => { ... });
```

Confirm enrollment using sms otp code
```javascript
	authenticatorEnrollment.confirm({ otpCode: '123456' })
		.then(() => { ... });
```

#### Authenticator enrollment
Get URI to generate enrollment QR
```javascript
	authenticatorEnrollment.getUri();
```

Confirm enrollment using a generated OTP code
```javascript
	authenticatorEnrollment.confirm({ otpCode: '123456' })
		.then(() => { ... });
```

#### Push notification enrollment
Get URI to generate enrollment QR
```javascript
	pushNotificationEnrollment.getUri();
```

The rest of the enrollment process will be handled by the phone, so nothing else
to do in this flow.

### Auth flow
Right now you can only have a single factor enrolled, but we are structuring this library
so we are prepared for multidevice enrollment

Get default factor
```javascript
	authFlow.getDefaultFactor() // === sms|authenticator|pushNotification
```

Start auth for factor
```javascript
	const manual = false;

	const pushNotificationAuth = authFlow.forFactor('pushNotification');
	const guardianAuthManual = authFlow.forFactor('pushNotification', true); // Fallback to manual flow for Guardian
	const smsAuth = authFlow.forFactor('sms');
	const authenticatorAuth = authFlow.forFactor('authenticator');
	const recoveryCodeAuth = authFlow.forFactor('recoveryCode');
```

#### SMS auth
Request for an otp code on an SMS
```javascript
	smsAuth.request()
		.then(() => {
			//...
		});
```

Verify the otp code
```javascript
	smsAuth.verify({ otpCode: '123456' })
		.then(() => {
			//...
		});
```

#### Push notification auth
Request login using pn
```javascript
	pushNotificationAuth.request()
		.then(() => {
			//...
		});
```

#### Manual Guardian auth
Confirm login manually entering the otp code
```javascript
	guardianAuthManual.verify({ otpCode: '123456' })
		.then(() => {
			//...
		});
```

#### Authenticator auth
Confirm login manually entering the otp code
```javascript
	authenticatorAuth.verify({ otpCode: '123456' })
		.then(() => {
			//...
		});
```

#### Recovery code auth
Confirm login using the recovery code
```javascript
	recoveryCodeAuth.verify({ recoveryCode: '123456' })
		.then(() => {
			//...
		});
```
