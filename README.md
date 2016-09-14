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
## Basic Usage

### Push notification auth example
Asuming that the enrollment is confirmed

```javascript
const GuardianJS = require('guardian-js');
const guardian = new GuardianJS({
	requestToken: //...,
	serviceDomain: //...,
	issuer: {
		name: //...,
		label: //...
	}
});

// Browser: when enrollment is complete post the result onto a server
Auth0GuardianJS.plugins
	.formPostCallback({ callbackUrl: "..." })(guardianjs);

guardian.start().then((transaction) => {
	if (transaction.isEnrolled()) {
		return transaction.startAuthForDefaultFactor().request();
	} else {
		// Handle enrollment
	}
})
.catch(err => {
	console.error(err);
});
```

### Push notification enrollment example
Asuming that the enrollment is not confirmed

```javascript
const Auth0GuardianJS = require('auth0-guardian-js');
const guardian = new Auth0GuardianJS({
	requestToken: //...,
	serviceDomain: //...,
	issuer: {
		name: //...,
		label: //...
	}
});

guardian.start().then((transaction) => {
	if (transaction.isEnrolled()) {
		// Handle enrollment (see above)
	} else {
		const uri = transaction.startEnrollment().forFactor('push').getUri();

		// At this point you should render QR, once the QR is scanned the rest of
		// the enrollment process is handled by your phone, as a convenience and
		// to handle all flows in an isomorphic way, the #enroll() and #verify()
		// methods are available and return a promise but they are NOOP methods.
	}
})
.catch(err => {
	console.error(err);
});

// TODO: We probably need more context on this event
guardian.once('enrollment-confirmed', () => {
	// Enrollment complete
});
```

## Full API Usage
First of all you need to instantiate the library

```javascript
const GuardianJS = require('guardian-js');
const guardian = new GuardianJS({
	requestToken: //...,
	serviceDomain: //...,
	issuer: {
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

As a shorthand you can start a transaction directly with the default factor
```javascript
const defaultFactorAuth = transaction.startAuthForDefaultFactor();

// Then you can do defaultFactorAuth.request()
// and defaultFactorAuth.verify()
```

### Events
```javascript
guardian.events.on('enrollment-complete', function() {
	// Enrollment confirmed
});

guardian.events.on('login-complete', function({ loginPayload }) {
	// Auth complete
});

guardian.events.on('timeout', function() {
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
const authenticatorEnrollment = enrollmentFlow.forFactor('otp');
const pushNotificationEnrollment = enrollmentFlow.forFactor('push');
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

#### OTP enrollment
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

Start auth for a factor
```javascript
const pushNotificationAuth = authFlow.forFactor('push');
const smsAuth = authFlow.forFactor('sms');
const otpAuth = authFlow.forFactor('otp');

const recoveryCodeAuth = authFlow.forRecoveryCode();
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

#### OTP Auth
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
