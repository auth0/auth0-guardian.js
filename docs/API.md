## Full API
Creating an instance

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
Authenticates using a recovery code, receives the recovery code as an string
with just alpha numeric characters (no separators, etc.) as result of this
method an `error` or `auth-response` error could be emitted; in case of
`auth-response` it will include `.recoveryCode` as part of the payload, that
recovery code is the new recovery code you must show to the user from him to save it.

```js
transaction.recover({ recoveryCode: recoveryCode });
```

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
guaranted to be triggered after `enrollment-complete`.

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
Emmited when there is an error on the transaction

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

### Enrollment

#### enrollment.getAvailableMethods()
Returns an array of strings that represent the authentication methods associated
with this enrollments, they are the only methods that (if available for this transaction)
can be used to authenticate the user based on the given enrollment.

```js
enrollments[i].getAvailableMethods();
```

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

You can find a list of the available error codes [here](ERRORS.md/#Error%20codes)
