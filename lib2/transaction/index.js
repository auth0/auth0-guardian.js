'use strict';

var object = require('./utils/object');
var async = require('./utils/async');
var EventEmitter = require('events').EventEmitter;
var errors = require('./errors');
var events = require('./utils/events');
var enrollmentBuilder = require('./entities/enrollment');
var helpers = require('./helpers');

var authVerificationStep = require('./auth_verification_step');
var enrollmentConfirmationStep = require('./enrollment_confirmation_step');

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

  self.authRecoveryStrategy = authRecoveryStrategy(authStrategiesData, { httpClient: httpClient });

  self.enrollmentAttempt = data.enrollmentAttempt;
  self.enrollments = data.enrollments || [];

  self.txId = data.transactionToken.getDecoded().txid;
  self.transactionToken = data.transactionToken;
  self.transactionEventsReceiver = options.transactionEventsReceiver;
  self.availableEnrollmentMethods = data.availableEnrollmentMethods;
  self.availableAuthenticationMethods = data.availableAuthenticationMethods;

  self.loginCompleteHub = events.buildEventHub(
    self.transactionEventsReceiver, 'login:complete');
  self.loginRejectedHub = events.buildEventHub(
    self.transactionEventsReceiver, 'login:rejected');
  self.enrollmentCompleteHub = events.buildEventHub(
    self.transactionEventsReceiver, 'enrollment:confirmed');

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
    apiPayload.txId = isEnrollmentAttemptActive ? self.txId : null;

    self.emit('enrollment-complete', helpers.buildEnrollmentCompletePayload({
      apiPayload: apiPayload,
      txId: self.txId,
      enrollmentAttempt: data.enrollmentAttempt,
      method: apiPayload.method || 'push' // TODO Remove default when QA gets deployed
    }));
  });

  self.loginCompleteHub.defaultHandler(function loginCompleteDef(apiPayload) {
    self.emit('auth-response', helpers.buildAuthCompletionPayload(true, apiPayload.signature));
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

  if (self.isEnrolled()) {
    async.setImmediate(callback, new errors.AlreadyEnrolledError());
    return;
  }

  if (object.get(self, 'availableEnrollmentMethods', []).length === 0) {
    async.setImmediate(callback, new errors.NoMethodAvailableError());
  }

  if (!object.contains(self.availableEnrollmentMethods, method)) {
    async.setImmediate(callback, new errors.EnrollmentMethodDisabledError(method));
  }

  var strategy = self.enrollmentStrategies[method];

  if (!strategy) {
    async.setImmediate(callback, new errors.MethodNotFoundError(method));
    return;
  }

  self.enrollmentAttempt.setActive(true);

  strategy.enroll(data, function onEnrollmentStarted(err) {
    if (err) {
      self.enrollmentAttempt.setActive(false);

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
      self.emit('enrollment-complete', payload);

      self.enrollmentAttempt.setActive(false);
    });

    confirmationStep.on('error', function onError(iErr) {
      self.enrollmentAttempt.setActive(false);

      self.emit('error', iErr);
    });

    return callback(null, confirmationStep);
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

  if (object.get(self, 'availableAuthenticationMethods', []).length === 0) {
    async.setImmediate(callback, new errors.NoMethodAvailableError());
  }

  if (!object.contains(self.availableAuthenticationMethods, options.method)) {
    async.setImmediate(callback, new errors.AuthMethodDisabledError(options.method));
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

    var confirmationStep = authVerificationStep(strategy, {
      loginCompleteHub: self.loginCompleteHub,
      loginRejectedHub: self.loginRejectedHub
    });

    confirmationStep.once('auth-response', function onAuthResponse(payload) {
      self.emit('auth-response', payload);
    });

    confirmationStep.once('error', function onAuthResponse(error) {
      self.emit('error', error);
    });

    return callback(null, confirmationStep);
  });
};

module.exports = transaction;
