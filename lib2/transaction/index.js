'use strict';

var object = require('../utils/object');
var async = require('../utils/async');
var EventEmitter = require('events').EventEmitter;
var errors = require('../errors');
var events = require('../utils/events');
var enrollmentBuilder = require('../entities/enrollment');
var helpers = require('./helpers');

var authVerificationStep = require('./auth_verification_step');
var enrollmentConfirmationStep = require('./enrollment_confirmation_step');

var authRecoveryStrategy = require('../auth_strategies/recovery_auth_strategy');

var smsEnrollmentStrategy = require('../enrollment_strategies/sms_enrollment_strategy');
var pnEnrollmentStrategy = require('../enrollment_strategies/pn_enrollment_strategy');
var otpEnrollmentStrategy = require('../enrollment_strategies/otp_enrollment_strategy');

var smsAuthStrategy = require('../auth_strategies/sms_auth_strategy');
var pnAuthStrategy = require('../auth_strategies/pn_auth_strategy');
var otpAuthStrategy = require('../auth_strategies/otp_auth_strategy');

var eventSequencer = require('../utils/event_sequencer');
var eventListenerHub = require('../utils/event_listener_hub');

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

  self.authRecoveryStrategy = authRecoveryStrategy(authStrategiesData, { httpClient: httpClient });

  self.enrollmentAttempt = data.enrollmentAttempt;
  self.enrollments = data.enrollments || [];

  self.txId = data.transactionToken.getDecoded().txid;
  self.transactionToken = data.transactionToken;
  self.transactionEventsReceiver = options.transactionEventsReceiver;
  self.availableEnrollmentMethods = data.availableEnrollmentMethods;
  self.availableAuthenticationMethods = data.availableAuthenticationMethods;

  self.loginCompleteHub = eventListenerHub(
    self.transactionEventsReceiver, 'login:complete');
  self.loginRejectedHub = eventListenerHub(
    self.transactionEventsReceiver, 'login:rejected');
  self.enrollmentCompleteHub = eventListenerHub(
    self.transactionEventsReceiver, 'enrollment:confirmed');

  self.eventSequencer = eventSequencer();
  self.eventSequencer.pipe(self);

  self.enrollmentCompleteHub.defaultHandler(function enrollmentCompleteDef(apiPayload) {
    self.addEnrollment(enrollmentBuilder(apiPayload.deviceAccount));

    // This is a workaround to prevent an edge case for when the enrollment
    // is not from current tx. It doesn't avoid it completely but reduces
    // its likehood.
    //
    // The source of the problem is that the transaction id is not easily
    // available from the mobile device
    var isEnrollmentAttemptActive = object.execute(data.enrollmentAttempt, 'isActive');

    // eslint-disable-next-line no-param-reassign
    apiPayload.txId = !apiPayload.txId && isEnrollmentAttemptActive ? self.txId : null;

    if (apiPayload.txId !== self.txId) {
      self.dismissEnrollmentAttempt();
    }

    self.eventSequencer.emit('enrollment-complete', helpers.buildEnrollmentCompletePayload({
      apiPayload: apiPayload,
      txId: self.txId,
      enrollmentAttempt: data.enrollmentAttempt,
      method: apiPayload.method || 'push' // TODO Remove default when QA gets deployed
    }));
  });

  self.loginCompleteHub.defaultHandler(function loginCompleteDef(apiPayload) {
    self.eventSequencer.emit('auth-response',
      helpers.buildAuthCompletionPayload(true, apiPayload.signature));
  });

  self.transactionToken.on('token-expired', function tokenExpiredDef() {
    self.eventSequencer.emit('timeout');
  });

  self.transactionEventsReceiver.on('error', function onError() {
    self.eventSequencer.emit('error');
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

  if (self.isEnrolled()) {
    async.setImmediate(callback, new errors.AlreadyEnrolledError());
    return;
  }

  if (object.get(self, 'availableEnrollmentMethods', []).length === 0) {
    async.setImmediate(callback, new errors.NoMethodAvailableError());
    return;
  }

  if (!object.contains(self.availableEnrollmentMethods, method)) {
    async.setImmediate(callback, new errors.EnrollmentMethodDisabledError(method));
    return;
  }

  var strategy = self.enrollmentStrategies[method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(method));
    return;
  }

  self.enrollmentAttempt.setActive(true);
  self.eventSequencer.addSequence('local-enrollment', ['auth-response', 'enrollment-complete']);

  strategy.enroll(data, function onEnrollmentStarted(err) {
    if (err) {
      self.dismissEnrollmentAttempt();

      return callback(err);
    }

    var confirmationStep = enrollmentConfirmationStep({
      strategy: strategy,
      transaction: self,
      enrollmentCompleteHub: self.enrollmentCompleteHub,
      enrollmentAttempt: self.enrollmentAttempt
    });

    confirmationStep.once('enrollment-complete', function onEnrollmentComplete(payload) {
      self.addEnrollment(payload.enrollment);
      self.eventSequencer.emit('enrollment-complete', payload);

      self.dismissEnrollmentAttempt();
    });

    confirmationStep.on('error', function onError(iErr) {
      self.dismissEnrollmentAttempt();

      self.eventSequencer.emit('error', iErr);
    });

    return callback(null, confirmationStep);
  });
};

transaction.prototype.dismissEnrollmentAttempt = function () {
  var self = this;

  self.eventSequencer.removeSequence('local-enrollment');
  self.enrollmentAttempt.setActive(false);
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
  if (!this.isEnrolled()) {
    async.setImmediate(callback, new errors.NotEnrolledError());
    return;
  }

  var availableMethods = enrollment.getAvailableMethods();

  if (arguments.length === 2) {
    callback = options; // eslint-disable-line no-param-reassign
    options = { method: availableMethods[0] }; // eslint-disable-line no-param-reassign
  }

  options = options || {}; // eslint-disable-line no-param-reassign

  if (!options.method) {
    options.method = availableMethods[0]; // eslint-disable-line no-param-reassign
  }

  if (object.get(this, 'availableAuthenticationMethods', []).length === 0) {
    async.setImmediate(callback, new errors.NoMethodAvailableError());
    return;
  }

  if (!object.contains(this.availableAuthenticationMethods, options.method)) {
    async.setImmediate(callback, new errors.AuthMethodDisabledError(options.method));
    return;
  }

  var strategy = this.authStrategies[options.method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(options.method));
    return;
  }

  this.removeAuthListeners();
  this.requestStrategyAuth(strategy, callback);
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

  self.requestStrategyAuth(self.authRecoveryStrategy,
    function onRecoveryRequested(err, recoveryAuth) {
      if (err) {
        return self.eventSequencer.emit('error', err);
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
  return this.availableEnrollmentMethods;
};

/**
 * @private
 *
 * @returns {array.<string>}
 */
transaction.prototype.getAvailableAuthenticationMethods
  = function getAvailableAuthenticationMethods() {
    return this.availableAuthenticationMethods;
  };

/**
 * @private
 *
 * @param {AuthStrategy} strategy
 * @param {EventEmitter} options.loginCompleteHub
 * @param {EventEmitter} options.loginRejectedHub
 */
transaction.prototype.requestStrategyAuth = function requestStrategyAuth(strategy, callback) {
  var self = this;

  strategy.request(function onAuthRequested(err) {
    if (err) {
      return callback(err);
    }

    var verificationStep = authVerificationStep(strategy, {
      loginCompleteHub: self.loginCompleteHub,
      loginRejectedHub: self.loginRejectedHub
    });

    verificationStep.once('auth-response', function onAuthResponse(payload) {
      self.eventSequencer.emit('auth-response', payload);
    });

    verificationStep.on('error', function onError(error) {
      self.eventSequencer.emit('error', error);
    });

    return callback(null, verificationStep);
  });
};

module.exports = transaction;
