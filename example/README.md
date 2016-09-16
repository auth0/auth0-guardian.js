# Basic widget example using Auth0GuardianJS
This [example](basic_widget.html) is designed to work on the [Guardian Customization Page](https://manage.auth0.com/#/guardian_mfa_page),
the parameters will be replaces automatically on this page.

## Try it by yourself
To try it you just need to:

1. Enable Guardian on [Auth0 Dashboard For Guardian](https://manage.auth0.com/#/guardian).
1. Copy and paste [the example code](basic_widget.html) on [Guardian Customization Page](https://manage.auth0.com/#/guardian_mfa_page).
1. Go to [Connections](https://manage.auth0.com/#/connections/database) and try it!

## A little bit of details on example code
Let's analyse the most important points of the example.

### Setup

```js
var guardianjs = new Auth0GuardianJS({
  serviceDomain: "{{ userData.tenant }}.guardian.auth0.com",
  requestToken: "{{ requestToken }}", // Token that autorizes a Guardian authentication Transaction

  issuer: {
    label: "{{ userData.friendlyUserId }}",
    name: "{{ userData.tenant }}",
  }
});

// Setup the formPostCallback plugin so it takes care of sending the
// login result to callback url (probably auth0) for us
Auth0GuardianJS.plugins
  .formPostCallback({
    callbackUrl: "{{ postActionURL }}" // Callback url where to POST the result
  })(guardianjs);

// This plugin exposes a method to trigger the post whenever you want,
// when you want to do so just call, if login-complete has already complete
// it will trigger the post automatically, otherwise it will do so as soon
// as the login-complete event get received
guardianjs.plugins.formPostCallback();
```

### Errors and timeout handling
Errors and timeout are pretty common events, make sure to start listening for
them as soon as posible.

```js
// Let's start listening for timeout in case the user takes too long
// to login and the transaction expires
guardianjs.events.on('timeout', function () {
  showError('Seems that you\'ve taken too long to login');
});

// Let's start listening for errors
guardianjs.events.on('error', function(err) {
  showError(err);
});
```

### Start an auth transaction
The base for Guardian authorization is a transaction, you can start a transaction
as following.

```js
guardianjs.start().then(function(transaction) {
  guardianjs.events.on('enrollment-complete', function(payload) {
    // If enrollment is complete but not the transaction
    // we need to render the login screen to continue the
    // transaction (push notifications)
    if (!payload.transactionComplete) {
      renderLogin(transaction);
    }

    // Get the recovery code
    console.log('Recovery code is: ' + payload.recoveryCode);
  });

  guardianjs.events.on('login-complete', function(p) {
    // Login is complete, since we have setup the `formPostCallback`
    // plugin the result is going to be sent to the callback url automatically
    showSuccess('Login complete');
  });

  guardianjs.events.on('login-rejected', function(p) {
    // Login has been rejected, the transaction can continue anyway
    showLocalError('Login rejected');
  });

  if (transaction.isEnrolled()) {
    // If user is enrolled let's go to login screen
    renderLogin(transaction);
  } else {
    // If user is not enrolled let's go to enrollment screen
    renderEnrollment(transaction);
  }

  return null;
})
.catch(showError);
```

### Enrollment
Assuming that current user is not enrolled, you can choose one of the available
factors to login to enroll with.

#### Starting the enrollment flow
```js
var enrollmentFlow = transaction.startEnrollment();
```

#### Knowing the available factors
```js
console.log(enrollmentFlow.getAvailableFactors());
```

#### Starting enrollment with a given factor
Some factors require you to provide enrollment information (e.g. Phone number for SMS Factor),
you can use the `.enroll(data)` method to provide this information

```js
var enrollmentFactor = enrollmentFlow.forFactor('sms');

enrollmentFactor.enroll({ phoneNumber: '+1 341 5643333' }).then(function () {
  showSuccess('enrollment has started');
})
.catch(showLocalError);
```

#### Confirm enrollment
Most factors require you to confirm the enrollment to make sure there wasn't any
mistakes during enrollment information exchange, you can use `.confirm` method to
do so.

```js
enrollmentFactor.confirm({
  // First otp code you get
  otpCode: '123456'
})
.catch(showLocalError);
```

Note: once enrollment is complete you will receive an `enrollment-complete` event,
you can listen for it using:

```js
guardianjs.events.on('enrollment-complete', function(payload) {
    // If enrollment is complete but not the transaction
    // we need to render the login screen to continue the
    // transaction (push notifications)
    if (!payload.transactionComplete) {
      renderLogin(transaction);
    }
  });
```

### Authentication

#### Requesting an authentication
The first step to authenticate using Guardian is requesting it, once you
have started the transaction you can request an authentication. For OTP
requesting an authentication doesn't have any effect, the method is
provided just as a convenience.

```js
var authFlow = transaction.startAuth();
var authFactor = transaction.forDefaultFactor();
```

Know what factor you are enrolled with
```js
var defaultFactor = authFactor.getDefaultFactor();
```

Execute the actual request
```js
authFactor.request()
  .then(function () {
    showMessage('Auth push/sms has been sent');

    return null;
  })
  .catch(showLocalError);
```

#### Verifiying second factor
For SMS and OTP you need to manually enter the code, use verify to check this code.
You will get the auth payload on the `login-complete` event. If you have setup
`formPostCallback` the payload is going to be send (form post) to the provided url.

```js
authFactor.verify(data)
  .catch(showLocalError);
```

### Recovery
Recovery works the same way as the other auth factors, there is only one difference:
how you get the `authFactor`, to do so you need to call `.startAuthForRecovery` on
the transaction instead of `.startAuthForDefaultFactor`.

```js
var authFactor = transaction.startAuthForRecovery();
```

Then you can use `.verify` with the recovery code to verify the recovery code
and, if valid, get an auth payload on the `login-complete` event.

```js
authFactor.verify({ recoveryCode: '123456789012345678901234' })
  .then(function () {
    showMessage('Code verified');

    return null;
  })
  .catch(showLocalError);
```
