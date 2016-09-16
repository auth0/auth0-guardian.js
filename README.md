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
const Auth0GuardianJS = require('auth0-guardian-js');

let guardianjs = new Auth0GuardianJS({
	serviceDomain: "{{ userData.tenant }}.guardian.auth0.com", // {name}.guardian.auth0.com
	requestToken: "{{ requestToken }}",
	postActionURL: "{{ postActionURL }}",
	issuer: {
		label: "{{ userData.friendlyUserId }}",
		name: "{{ userData.tenant }}",
	}
});

// Configure the plugin to post the 'auth-complete' result to auth0-server
Auth0GuardianJS.plugins.formPostCallback({
	callbackUrl: "{{ postActionURL }}",

	// Automatically send the result to auth0 as soon as you receive 'auth-complete'
	// event, if false you will have to call guardianjs.plugins.formPostCallback()
	// to send the result to auth0
	autoTrigger: true
})(guardianjs);
```
### Enrollment
To enroll a device is a process composed of the following steps:

1. Start the transaction
1. (optional) Check if the user is already enrolled. You cannot enroll twise.
1. Send the information needed to enroll
1. Confirm your enrollment
1. Show the recovery code

Some steps can be ommited depending on the factor, we provide the same interface
for all factors so you can write an uniform code.
Some of the factors end up completing the authentication, whereas some other need
an extra authentication step. You can know that by listening to the
`enrollment-complete` event

```js
guardianjs.events.on('enrollment-complete', (payload) => {
	// Show recovery code
	console.log(payload.recoveryCode);

	if (payload.transactionComplete) {
		//... It is complete, you don't need to do anything else
		return;
	}

	// Go to authentication
});
```

#### SMS Enrollment
```js
guardianjs.start((transaction) => {
	if (transaction.isEnrolled()) {
		console.log('You are already enrolled');
		return;
	}

	enrollmentFlow = transaction.startEnrollment();
	smsEnrollment = enrollmentFlow.forFactor('sms');

	const phoneNumber = // ...Collect phone number here

	return smsEnrollment.enroll({ phoneNumber });
})
.then(() => {
	const otpCode = // ...Collect verification otp here

	return smsEnrollment.confirm({ otpCode })
});
```

#### Push enrollment
```js
guardianjs.events.on('enrollment-complete', function(payload) {
	// ... Enrollment is complete but for push you need to start authentication
	// the other factors don't need authentication
	// if you want to handle this in a generic way use

	if (payload.transactionComplete) {
		return;
	}

	showAuthentication( ... );
});

guardianjs.start((transaction) => {
	if (transaction.isEnrolled()) {
		console.log('You are already enrolled');
		return;
	}

	enrollmentFlow = transaction.startEnrollment();
	pushEnrollment = enrollmentFlow.forFactor('push');

	// Show the QR to enroll
	showQR(pushEnrollment.getUri());
});
```

#### OTP enrollment
```js
guardianjs.start((transaction) => {
	if (transaction.isEnrolled()) {
		console.log('You are already enrolled');
		return;
	}

	enrollmentFlow = transaction.startEnrollment();
	otpEnrollment = enrollmentFlow.forFactor('otp');

	// Show the QR to enroll
	showQR(otpEnrollment.getUri());

	const otpCode = // Collect first otp code
	return otpEnrollment.verify({ otpCode });
});
```

### Authentication
To authenticate with a factor you need to execute the following steps

1. Start the transaction
1. (optional) Check if the user is already enrolled. You need to be enrolled to
authenticate.
1. Request the factor (the push notification / sms). Request is a noop for OTP
1. Verify the otp (`.verify` is a noop for push)

Some steps can be ommited depending on the factor, we provide the same interface
for all factors so you can write an uniform code.
After the factor is verified or the push accepted you will receive an
`auth-complete` event with the payload to send to the server, if you have already
setup the `formPostCallback` plugin you don't need to do anything else.

You may also receive `auth-rejected` if the push notification was received.

#### SMS Authentication
Asuming you are enrolled with sms

```js
guardianjs.start((transaction) => {
	if (!transaction.isEnrolled()) {
		console.log('You need to enroll first');
		return;
	}

	authFlow = transaction.startAuth();
	smsEnrollment = authFlow.ForDefaultFactor(); // or .forFactor('sms')

	// Request SMS
	return smsEnrollment.request();
})
.then(() => {
	const otpCode = // ...Collect otp here

	return smsEnrollment.verify({ otpCode })
});
```

#### OTP Authentication
Asuming you are enrolled with otp
```js
guardianjs.start((transaction) => {
	if (!transaction.isEnrolled()) {
		console.log('You need to enroll first');
		return;
	}

	authFlow = transaction.startAuth();
	otpEnrollment = authFlow.forDefaultFactor(); // or .forFactor('otp')

	// Request OTP (optional, it is a noop)
	return otpEnrollment.request();
})
.then(() => {
	const otpCode = // ...Collect verification otp here

	return smsEnrollment.verify({ otpCode })
});
```

#### Push notification Authentication
Asuming you are enrolled with otp
```js
guardianjs.events.on('auth-rejected', function() {
	// The push auth was rejected
});

guardianjs.start((transaction) => {
	if (!transaction.isEnrolled()) {
		console.log('You need to enroll first');
		return;
	}

	authFlow = transaction.startAuth();
	otpEnrollment = authFlow.forDefaultFactor(); // or .forFactor('otp')

	// Request push notification
	return otpEnrollment.request();
});
```

### Recovery
Recovery works as authentication, but instead of passing an otpCode, you need
to pass a recovery code to verify method

```js
guardianjs.start((transaction) => {
	if (!transaction.isEnrolled()) {
		console.log('You need to enroll first');
		return;
	}

	authFlow = transaction.startAuth();
	recoveryEnrollment = authFlow.forRecoveryCode(); // or .forFactor('otp')

	// Request OTP (optional, it is a noop)
	return recoveryEnrollment.request();
})
.then(() => {
	const recoveryCode = // ...Collect recovery code here

	return recoveryEnrollment.verify({ recoveryCode })
});
```

## Full API
First of all you need to instantiate the library

```javascript
const Auth0GuardianJS = require('auth0-guardian-js');
const guardian = new Auth0GuardianJS({
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

Ask which factors are available
```javascript
transaction.getAvailableFactors();
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
guardian.events.on('enrollment-complete', function ({ factor, transactionComplete, recoveryCode, enrollment }) {
	// Enrollment confirmed
});

guardian.events.on('auth-complete', function({ factor, recovery, accepted, loginPayload }) {
	// Auth complete
});

guardian.events.on('timeout', function () {
	// Transaction time out
});

guardian.events.on('error', function(error /* instanceOf GuardianError */) {
	// Errors that cannot be associated to a particular action, like socket.io errors or so
});
```

### Enrollment flow
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

// You can also use
authFlow.startAuthForDefaultFactor();
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
