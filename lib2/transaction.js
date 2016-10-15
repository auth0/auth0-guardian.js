'use strict';

var object = require('./utils/object');
var async = require('./utils/async');
var EventEmitter = require('events').EventEmitter;
var errors = require('./errors/method_not_found_error');
var events = require('./utils/events');
var enrollmentBuilder = require('./entities/enrollment');

var authRecoveryStrategy = require('./auth_strategies/recovery_auth_strategy');

var smsEnrollmentStrategy = require('./enrollment_strategies/sms_enrollment_strategy');
var pnEnrollmentStrategy = require('./enrollment_strategies/pn_enrollment_strategy');
var otpEnrollmentStrategy = require('./enrollment_strategies/otp_enrollment_strategy');

var smsAuthStrategy = require('./auth_strategies/sms_auth_strategy');
var pnAuthStrategy = require('./auth_strategies/pn_auth_strategy');
var otpAuthStrategy = require('./auth_strategies/otp_auth_strategy');

/**
 * @public
 *
 * Represents a Guardian transaction
 *
 * @param {array.<Enrollment>} data.enrollments
 *  Confirmed enrollments (available when you are enrolled)
 * @param {array.<EnrollmentAttempt>} [data.enrollmentAttempt]
 *  Enrollment attempt (when you are not enrolled)
 * @param {array.<string>} data.availableEnrollmentMethods
 * @param {JWTToken} data.transactionToken
 *
 * @param {EventEmitter} options.transactionEventsReceiver
 *  Receiver for transaction events; it will receive  backend related transaction events
 * @param {HttpClient} options.HttpClient
 *
 * @returns {Transaction}
 */
function transaction(data, options) {
  var self = object.create(transaction.prototype);

  var httpClient = options.httpClient;

  var enrollmentStrategyData = {
    enrollmentAttempt: data.enrollmentAttempt,
    transactionToken: data.transactionToken
  };

  self.enrollmentStrategies = {
    sms: smsEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient }),
    push: pnEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient }),
    otp: otpEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient })
  };

  var authStrategiesData = { transactionToken: data.transactionToken };

  self.authStrategies = {
    sms: smsAuthStrategy(authStrategiesData, { httpClient: httpClient }),
    push: pnAuthStrategy(authStrategiesData, { httpClient: httpClient }),
    otp: otpAuthStrategy(authStrategiesData, { httpClient: httpClient })
  };

  self.txId = data.transactionToken.getDecoded().tx_id;
  self.transactionToken = data.transactionToken;
  self.transactionEventsReceiver = options.transactionEventsReceiver;
  self.availableEnrollmentMethods = data.availableEnrollmentMethods;

  self.loginCompleteHub = events.buildEventHub(
    self.transactionEventsReceiver, 'login:complete');
  self.loginRejectedHub = events.buildEventHub(
    self.transactionEventsReceiver, 'login:rejected');
  self.enrollmentCompleteHub = events.buildEventHub(
    self.transactionEventsReceiver, 'enrollment:confirmed');

  self.enrollmentCompleteHub.defaultHandler(function enrollmentCompleteDef(apiPayload) {
    self.addEnrollment(enrollmentBuilder(apiPayload.deviceAccount));

    self.emit('enrollment-complete', buildEnrollmentCompletePayload({ apiPayload: apiPayload }));
  });

  self.loginCompleteHub.defaultHandler(function loginCompleteDef(apiPayload) {
    self.emit('auth-response', buildAuthCompletionPayload(true, apiPayload.signature));
  });

  self.transactionToken.on('token-expired', function tokenExpiredDef() {
    self.emit('timeout');
  });

  return self;
}

transaction.prototype = object.create(EventEmitter.prototype);

/**
 * @public
 *
 * Start an enrollment on this transaction
 */
transaction.prototype.enroll = function enroll(method, data, callback) {
  var self = this;

  var strategy = self.enrollmentStrategies[method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(method));
  }

  strategy.enroll(data, function onEnrollmentStarted(err) {
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

/**
 * @public
 *
 * Starts authentication process
 *
 * @param {Enrollment} enrollment
 * @param {sms|otp|push} options.method
 */
transaction.prototype.requestAuth = function requestAuth(enrollment, options, callback) {
  this.removeAuthListeners();

  if (arguments.length === 2) {
    var availableMethods = enrollment.getAvailableMethods();

    callback = options; // eslint-disable-line no-param-reassign
    options = { method: availableMethods[0] }; // eslint-disable-line no-param-reassign
  }

  var strategy = this.authStrategies[options.method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(options.method));
  }

  commonRequestAuth(strategy, this.loginCompleteHub, callback);
};

/**
 * @public
 *
 * Authenticate using recovery code
 *
 * @param {string} data.recoveryCode
 */
transaction.prototype.recover = function recover(data) {
  var self = this;

  commonRequestAuth(authRecoveryStrategy, this.loginCompleteHub,
    function onRecoveryRequested(err, recoveryAuth) {
      if (err) {
        return self.emit('error', err);
      }

      return recoveryAuth.verify(data);
    });
};

/**
 * @public
 *
 * @returns {boolean} whether there is at least one enrollment
 */
transaction.prototype.isEnrolled = function isEnrolled() {
  return this.enrollments.length > 0;
};

/**
 * @public
 *
 * @returns {array.<Enrollment>} enrollments
 */
transaction.prototype.getEnrollments = function getEnrollments() {
  return this.enrollments;
};

/**
 * @private
 *
 * TODO: This goes against immutability but it is the easiest way to prepare
 * the transaction for auth once enrollment-attempt is complete
 */
transaction.prototype.addEnrollment = function addEnrollment(enrollment) {
  this.enrollments.push(enrollment);
};

/**
 * @private
 */
transaction.prototype.removeAuthListeners = function removeAuthListeners() {
  var self = this;

  self.loginCompleteHub.removeAllListeners();
  self.loginRejectedHub.removeAllListeners();
};

/**
 * @public
 */
transaction.prototype.getAvailableEnrollmentMethods = function getAvailableEnrollmentMethods() {
  return self.availableEnrollmentMethods;
};

function commonRequestAuth(strategy, loginCompleteHub, callback) {
  strategy.request(function onAuthRequested(err) {
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
  var self = object.create(enrollmentConfirmationStep.prototype);
  self.strategy = options.strategy;
  self.enrollmentAttempt = options.enrollmentAttempt;
  self.enrollmentCompleteHub = options.enrollmentCompleteHub;

  return self;
}

enrollmentConfirmationStep.prototype.getUri = function getUri() {
  return this.strategy.getUri();
};

enrollmentConfirmationStep.prototype.confirm = function confirm(data) {
  var self = this;
  self.enrollmentCompleteHub.removeAllListeners();

  var listenToEnrollmentCompleteTask = function listenToEnrollmentCompleteTask(done) {
    self.enrollmentCompleteHub.listenOnce(function onEnrollmentComplete(payload) {
      done(payload);
    });
  };

  var confirmTask = function confirmTask(done) {
    self.strategy.confirm(data, done);
  };

  async.all([
    listenToEnrollmentCompleteTask,
    confirmTask
  ], function onAllComplete(err, results) {
    self.enrollmentCompleteHub.removeAllListeners();

    if (err) {
      return self.emit('error', err);
    }

    var apiPayload = results[0];

    self.addEnrollment(enrollmentBuilder(apiPayload.deviceAccount));

    var payload = buildEnrollmentCompletePayload({
      apiPayload: apiPayload,
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

  var listenLoginRejectedTask = function listenLoginRejectedTask(done) {
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
}

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
}

module.exports = transaction;
