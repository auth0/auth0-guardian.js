'use strict';

var object = require('./utils/object');
var async = require('./utils/async');
var EventEmitter = require('events').EventEmitter;
var errors = require('./errors/method_not_found_error');
var events = require('./utils/events');

var authRecoveryStrategy;

var enrollmentStrategies = {
  'sms': {},
  'push': {},
  'otp': {}
};

var authStrategies = {
  'sms': {},
  'push': {},
  'otp': {}
};

/**
 * @param {array.<Enrollment>} data.enrollments Confirmed enrollments (available when you are enrolled)
 * @param {array.<EnrollmentAttempt>} [data.enrollmentAttempt] Enrollment attempt (when you are not enrolled)
 * @param {JWTToken} data.transactionToken
 *
 * @param {EventEmitter} options.transactionEventsReceiver Receiver for transaction events; it will receive
 *   backend related transaction events
 *
 * @returns {Transaction}
 */
function transaction(data, options) {
  var self = object.create(transaction.prototype);

  self.txId = data.transactionToken.getDecoded().tx_id;
  self.transactionToken = data.transactionToken;
  self.transactionEventsReceiver = options.transactionEventsReceiver;

  self.loginCompleteHub = events.buildEventHub(self.transactionEventsReceiver, 'login:complete');
  self.loginRejectedHub = events.buildEventHub(self.transactionEventsReceiver, 'login:rejected');
  self.enrollmentCompleteHub = events.buildEventHub(self.transactionEventsReceiver, 'enrollment:confirmed');

  self.enrollmentCompleteHub.defaultHandler(function(apiPayload) {
    self.emit('enrollment-complete', buildEnrollmentCompletePayload({ apiPayload: apiPayload }));
  });

  self.loginCompleteHub.defaultHandler(function(apiPayload) {
    self.emit('auth-response', buildAuthCompletionPayload(true, apiPayload.signature))
  });

  self.transactionToken.on('token-expired', function() {
    self.emit('timeout');
  });

  return self;
}

transaction.prototype = object.create(EventEmitter.prototype);

transaction.prototype.enroll = function enroll(method, data, callback) {
  var self = this;

  var strategy = enrollmentStrategies[method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(method));
  }

  strategy.enroll(data, function(err) {
    if (err) {
      return callback(err);
    }

    return callback(null, enrollmentConfirmationStep({
      strategy: strategy,
      enrollmentCompleteHub: self.enrollmentCompleteHub,
      enrollmentAttempt: self.enrollmentAttempt
    }));
  });
};

transaction.prototype.requestAuth = function requestAuth(enrollment, options, callback) {
  this.removeAuthListeners();

  if (arguments.length === 2) {
    var availableMethods = enrollment.getAvailableMethods();

    callback = options;
    options = { method: availableMethods[0] };
  }

  var strategy = authStrategies[options.method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(method));
  }

  commonRequestAuth(strategy, this.loginCompleteHub, callback);
};

transaction.prototype.recover = function recover(data, callback) {
  commonRequestAuth(authRecoveryStrategy, this.loginCompleteHub, function(err, recoveryAuth) {
    if (err) {
      return callback(err);
    }

    return recoveryAuth.verify(data, callback);
  });
};

transaction.prototype.isEnrolled = function isEnrolled() {
  return this.enrollments.length > 0;
};

transaction.prototype.getEnrollments = function getEnrollments() {
  return this.enrollments;
};

/**
 * Remove all event listeners
 *
 * @param {string} eventName
 */
transaction.prototype.removeAllListeners = function(eventName) {
  this.transactionEventsReceiver.removeAllListeners(eventName);
};

transaction.prototype.removeAuthListeners = function() {
  var self = this;

  self.loginCompleteHub.removeAllListeners();
  self.loginRejectedHub.removeAllListeners();
};

function commonRequestAuth(strategy, loginCompleteHub, callback) {
  strategy.request(function(err) {
    if (err) {
      return callback(err);
    }

    return callback(null, authVerificationStep(strategy, loginCompleteHub));
  });
}

/**
 * @param {EnrollmentStrategy} options.strategy
 * @param {EnrollmentAttempt} options.enrollmentAttempt
 * @param {EventEmitter} options.enrollmentCompleteHub
 */
function enrollmentConfirmationStep(options) {
  var self = object.create(confirmationStep.prototype);
  self.strategy = options.strategy;
  self.enrollmentAttempt = options.enrollmentAttempt
  self.enrollmentCompleteHub = options.enrollmentCompleteHub;

  return self;
}

enrollmentConfirmationStep.prototype.confirm = function confirm(data, callback) {
  var self = this;
  self.enrollmentCompleteHub.removeAllListeners();

  var listenToEnrollmentCompleteTask = function(done) {
    self.enrollmentCompleteHub.listenOnce(function(payload) {
      done(payload);
    });
  };

  var confirmTask = function(done) {
    self.strategy.confirm(data, done);
  };

  async.all([
    listenToEnrollmentCompleteTask,
    confirmTask
  ], function(err, results) {
    self.enrollmentCompleteHub.removeAllListeners();

    if (err) {
      return self.emit('error', err);
    }

    var payload = buildEnrollmentCompletePayload({
      apiPayload: results[0],
      strategy: self.strategy,
      enrollmentAttempt: self.enrollmentAttempt
    });

    return self.emit('enrollment-complete', payload);
  });
};

function authVerificationStep(strategy, loginCompleteHub) {
  var self = object.create(authVerificationStep.prototype);
  self.strategy = strategy;
  self.loginCompleteHub = loginCompleteHub;

  return self;
}

authVerificationStep.prototype.verify = function verify(data, callback) {
  var self = this;

  self.removeAuthListeners();

  var listenLoginCompleteTask = function listenLoginCompleteTask(done) {
    self.loginCompleteHub.listenOnce(function onLoginComplete(completionPayload) {
      done(null, buildAuthCompletionPayload(true, completionPayload.signature));
    });
  };

  var listenLoginRejectedTask = function listenLoginRejectedTask(payload) {
    self.loginRejectedHub.listenOnce(function onLoginRejected() {
      done(null, buildAuthCompletionPayload(false, null));
    });
  };

  var loginOrRejectTask = function loginOrRejectTask(done) {
    async.any([listenLoginCompleteTask, listenLoginRejectedTask], done);
  };

  var verifyAuthTask = function verifyAuthTask(done) {
    this.strategy.verify(data, function onVerified(err, verificationPayload) {
      if (err) {
        return callback(err);
      }

      return done(null, {
        // New recovery code if needed (recover)
        recoverCode: verificationPayload.recoverCode
      });
    });
  };

  // This function takes care of the possible difference on arrival because
  // of the difference on transportation layer, it is perfectly possible
  // for completion event to arrive BEFORE the http call response
  async.all([
    loginOrRejectTask,
    verifyAuthTask
  ], function onCompletion(err, payloads) {
    self.removeAuthListeners();

    if (err) {
      return self.emit('error', err);
    }

    return self.emit('auth-response', object.assign.apply(object, payloads));
  });
};

function buildAuthCompletionPayload(accepted, signature) {
  return {
    accepted: accepted,
    signature: signature
  };
};

/**
 * @param {object} apiPayload
 * @param {EnrollmentStrategy} strategy
 * @param {EnrollmentAttempt} EnrollmentAttempt
 */
function buildEnrollmentCompletePayload(options) {
  var apiPayload = options.apiPayload;
  var strategy = options.strategy;
  var enrollmentAttempt = options.enrollmentAttempt;

  var payload = {};

  if (enrollmentAttempt && apiPayload.txId === this.txId) {
    // Belongs to this transaction
    payload.recoveryCode = enrollmentAttempt.getRecoveryCode();
    payload.authRequired = enrollmentAttempt.isAuthRequired(strategy.method);
  } else {
    payload.recoveryCode = null;

    // Enrollment was not made from this transaction which means
    // you will have to login to continue
    payload.authRequired = true;
  }

  return payload;
};

module.exports = transaction;
