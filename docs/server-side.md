# Using Guardian JS Client from server side (beta)

You can use Guardian Client from server side, by default Guardian Client from server side
works exactly like in the browser. Meaning, it opens a web socket connection through socket.io
and uses it to interact with the server exactly as in the client side.

However, for certain use cases it is better not to have this automatic behavior, in particular,
you might want to manually check the state of the transaction and avoid not necessary external
connections or use a polling approach instead of the classic socket-based approach.

## Using manual transaction state check instead of websocket or polling

To manually check the state of the transaction you need to configure guardian JS
not to use a socket client, you can do so by setting `stateCheckingMechanism` to `manual` in
the configuration.

Keep in mind, that by doing so you will stop getting automatic events, i.e. you won't receive
`enrollment-complete` and `auth-response` events and their handlers won't be executed automatically
when the transaction state changes on Guardian servers.

Enrollment is the only valid scenario for server side usage.

### Serializing a transaction
Serializing a transaction allows you to save an active transaction and resume it later if it is not
expired, it is specially suitable for server-side usage were you might want to save a transaction
once the request finishes and resume it in a follow up request.

The following method will create a new transaction if a ticket is available or try to resume it
from session.

```js
function getGuardianTransaction(req, options, cb) {
  options = options || {};

  if (options.ticket) {
    // Start a new transaction if a ticket is available

    return void guardianJSBuilder({
      serviceUrl: process.env.GUARDIAN_URL,
      ticket: options.ticket,

      issuer: {
        label: env.GUARDIAN_ISSUER_LABEL,
        name: env.GUARDIAN_ISSUER_NAME
      },

      accountLabel: req.user.email,

      stateCheckingMechanism: 'manual'
    }).start(cb);
  }

  if (req.session.mfaTx) {
    // Resume a transaction if it is available in session

    return void guardianJSBuilder.resume({ stateCheckingMechanism: 'manual' }, req.session.mfaTx, cb);
  }

  cb(new HttpError(403, 'no_session_active', 'There is no valid mfa transaction active, nor ticket provided'));
}
```

### Enrollment example 1: supports all methods using manual state checking mechanism

```js
// WARNING 1: This is an advanced example, before using it consider if the
// hosted-page option does not match you use case, they are easier to implement
// and better suited for most use cases.
//
// WARNING 2: POST Methods require CSRF protection, don't forget to add them or
// you will be at risk of CSRF attacks, this example left them out for simplicity
// reasons and because there are many different ways to add them that
// are really specific to your environment.

'use strict'

const guardianJSBuilder = require('auth0-guardian-js');

router.post('/api/mfa/guardian/start', function(req, res, next) {
  async.waterfall([
    cb => auth0api.createGuardianEnrollmentTicket(req.user.id, cb),

    (ticket, cb) => getGuardianTransaction(req, { ticket: req.body.ticket }, (err, transaction) => {
      if (err) { return void cb(err); }

      cb(null, transaction);
    })
  ], (err, transaction) => {
    if (err) { return void next(err); }

    req.session.mfaTx = transaction.serialize();

    res.sendStatus(204);
  });
});

router.post('/api/mfa/guardian/enroll',

  // Validates input information this middleware could be removed since
  // guardian-js will make many of the validations though it is not recommended
  validateEnrollInput,

  function(req, res, next) {
    async.waterfall([
      (cb) => getGuardianTransaction(req, null, (err, transaction) => {
        if (err) { return void cb(err); }

        cb(null, transaction);
      }),

      (transaction, cb) => transaction.enroll(
        req.body.method,
        req.body.data,
        (err, enrollment) => cb(err, transaction, enrollment)
      )
    ], (err, transaction, enrollment) => {
      if (err) {
        return void next(err);
      }

      req.session.mfaTx = transaction.serialize();

      res.json({
        method: req.body.method,
        uri: enrollment.getUri()
      });
    });
  });

router.post('/api/mfa/guardian/confirm',

  // Validates input information this middleware could be removed since
  // guardian-js will make many of the validations though it is not recommended
  validateConfirmInput,

  function(req, res, next) {
    getGuardianTransaction(req, null, (err, transaction) => {
      transaction.getEnrollmentConfirmationStep().confirm({ otpCode: req.body.otpCode }, (err, data) => {
        if (err) {
          return void next(err);
        }

        req.session.mfaTx = transaction.serialize();

        res.sendStatus(204);
      });
    })
  });

// Poll this endpoint to get transaction state
router.post('/api/mfa/guardian/state', function(req, res, next) {
  getGuardianTransaction(req, null, (err, transaction) => {
    if (err) {
      next(err);
    }

    transaction.getState(function(err, state) {
      if (err) { return void next(err); }

      if (state.enrollment) {
        req.session.mfaTx = null;
      }

      res.json({
        enrolled: !!state.enrollment
      });
    });
  });
});
```

### Enrollment example 2: supports otp and sms methods no polling needed

```js
// WARNING 1: This is an advanced example, before using it consider if the
// hosted-page option does not match you use case, they are easier to implement
// and better suited for most use cases.
//
// WARNING 2: POST Methods require CSRF protection, don't forget to add them or
// you will be at risk of CSRF attacks, this example left them out for simplicity
// reasons and because there are many different ways to add them that
// are really specific to your enrollment.

'use strict'

const guardianJSBuilder = require('auth0-guardian-js');

router.post('/api/mfa/guardian/enroll',

  // Validates input information this middleware could be removed since
  // guardian-js will make many of the validations though it is not recommended
  validateEnrollInput,

  function(req, res, next) {
    async.waterfall([
      (cb) => getGuardianTransaction(req, { ticket: req.body.ticket }, (err, transaction) => {
        if (err) { return void cb(err); }

        cb(null, transaction);
      }),

      (transaction, cb) => transaction.enroll(
        req.body.method,
        req.body.data,
        (err, enrollment) => cb(err, transaction, enrollment)
      )
    ], (err, transaction, enrollment) => {
      if (err) {
        return void next(err);
      }

      req.session.mfaTx = transaction.serialize();

      res.json({
        method: req.body.method,
        uri: enrollment.getUri()
      });
    });
  });

router.post('/api/mfa/guardian/confirm',

  // Validates input information this middleware could be removed since
  // guardian-js will make many of the validations though it is not recommended
  validateConfirmInput,

  function(req, res, next) {
    getGuardianTransaction(req, null, (err, transaction) => {
      transaction.getEnrollmentConfirmationStep().confirm({ otpCode: req.body.otpCode }, (err, data) => {
        if (err) {
          return void next(err);
        }

        req.session.mfaTx = null;

        res.sendStatus(204);
      });
    })
  });
});
```

### Discussion: Sockets / polling vs manual transaction state checking
TL;DR You may want to use manual transaction state checking when you don't want
to keep an open socket nor poll the service for changes and you are not using
push notifications or you want to control the checking interval on you own.

#### Sockets / polling
Keeping an open socket (or polling) server side involves certain complexities you will have
to deal with, on the one hand, every socket is an open connection to handle, also
a socket is inherently connected to a single node, which will need to keep a transaction
"in memory" to handle the events once they arrive (probably sending them
back to the browser client) this means that if that particular node fails the whole
transaction will fail. You can deal with that in many different ways:

- using sticky sessions: this ensures that all your connections for a given
user/browser are handled by the same node, but if the node fails, the whole
transaction is aborted, also sticky sessions are difficult to scale under certain
scenarios.

- by serializing and reusing the transaction in different nodes but ensuring
that only one node is listening to the events, that way the load can be
distributed across your nodes, but only one node will handle the transaction-state
change events, meaning that if that node fails the whole transaction is aborted.

- by serializing and reusing the transaction in different nodes but letting all
of them open a socket (or poll) for events. This way, even if a node fails the other
nodes can still respond and the transaction won't be aborted. This is probably the
most complex scenario, since more than one node will receive the events you need to
make sure the handlers are idempotent meaning that executing them more than once
over the same input has the same effect as executing them only once.

All of these scenarios involve an "in memory" transaction in at least one of your
nodes.

#### Manual transaction state checking
Keeping an open socket or polling might not be the right solution for all the
scenarios, sometimes you might be able to guess fairly well (based on external
conditions) when an certain transaction might have succeed and you might want
to check only in such case: for example, if you don't want to use push notifications
but instead just OTP / SMS, you know that once you send the otp code and it has been
received by the server the transaction is succeed or rejected. Also, even if you
use push notifications, you might want to avoid automatic polling and control transaction
state check based on external conditions, for example, letting the client control
the polling rhythm by calling a transaction-state check endpoint under certain limits.

For such cases you can manually check the state of the transaction, this combined with
transaction serialization might help you solve complex scenarios and in particular
the ones described above:

- You don't need to keep a transaction in memory until transaction timeout:
simply serialize it and store in your preferred db, when you are ready to check
the state deserialize it and check its state as many times as you want.

- You can reuse the same transaction in different nodes: you don't need session
stickiness, if you have the serialized transaction in a common source of truth for
all your nodes different nodes can handle the load for a particular transaction simply
deserializing it and checking its state.

- You can respond synchronously under certain conditions: if you don't need push
notifications you know that once your otp code has been received by the server
your transaction is either accepted or rejected and so you can respond synchronously
to otp verification calls.



