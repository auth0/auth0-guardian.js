'use strict';

var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var EventEmitter = require('events').EventEmitter;
var errors = require('../errors');
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
var events = require('../utils/events');

var VALID_METHODS = ['otp', 'sms', 'push'];

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
 * @param {object} [data.authVerificationStep]
 * @param {otp|push|sms} data.authVerificationStep.method
 *
 * @param {object} [data.enrollmentConfirmationStep]
 * @param {otp|push|sms} data.enrollmentConfirmationStep.method
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
  self.httpClient = httpClient;

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
    otp: otpAuthStrategy(authStrategiesData, { httpClient: httpClient }),
    'recovery-code': authRecoveryStrategy(authStrategiesData, { httpClient: httpClient })
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
    var newEnrollment = enrollmentBuilder(apiPayload.deviceAccount);
    self.addEnrollment(newEnrollment);

    // This is a workaround to prevent an edge case for when the enrollment
    // is not from current tx. It doesn't avoid it completely but reduces
    // its likehood.
    //
    // The source of the problem is that the transaction id is not easily
    // available from the mobile device
    var isEnrollmentAttemptActive = object.execute(data.enrollmentAttempt, 'isActive');

    // eslint-disable-next-line no-param-reassign
    apiPayload.txId = !apiPayload.txId && isEnrollmentAttemptActive ? self.txId : apiPayload.txId;

    if (apiPayload.txId !== self.txId) {
      self.dismissEnrollmentAttempt();
    }

    self.eventSequencer.emit('enrollment-complete', helpers.buildEnrollmentCompletePayload({
      enrollment: newEnrollment,
      apiPayload: apiPayload,
      txId: self.txId,
      enrollmentAttempt: data.enrollmentAttempt,
      method: apiPayload.method || 'push' // TODO Remove
    }));
  });

  self.loginCompleteHub.defaultHandler(function loginCompleteDef(apiPayload) {
    self.eventSequencer.emit('auth-response',
      helpers.buildAuthCompletionPayload(true, apiPayload.signature));
  });

  self.loginRejectedHub.defaultHandler(function loginCompleteDef() {
    self.eventSequencer.emit('auth-response',
      helpers.buildAuthCompletionPayload(false, null));
  });

  self.transactionToken.on('token-expired', function tokenExpiredDef() {
    self.eventSequencer.emit('timeout');
  });

  self.transactionEventsReceiver.on('error', function onError(err) {
    self.eventSequencer.emit('error', err);
  });

  self.authVerificationStep = data.authVerificationStep;
  self.enrollmentConfirmationStep = data.enrollmentConfirmationStep;

  if (data.enrollmentConfirmationStep && data.enrollmentConfirmationStep.method) {
    self.enrollmentConfirmationStep = self.buildEnrollmentConfirmationStep(
      data.enrollmentConfirmationStep);
  }

  if (data.authVerificationStep && data.authVerificationStep.method) {
    self.authVerificationStep = self.buildAuthVerificationStep(
      data.authVerificationStep);
  }

  return self;
}

transaction.prototype = object.create(EventEmitter.prototype);

/**
 * @param {object} data
 * @param {otp|push|sms} data.method
 */
transaction.prototype.buildAuthVerificationStep = function buildAuthVerificationStep(data) {
  var self = this;

  if (typeof data !== 'object') {
    throw new errors.UnexpectedInputError('Expected data to be an object');
  }

  if (VALID_METHODS.indexOf(data.method) < 0) {
    throw new errors.UnexpectedInputError('Expected data.method to be one of ' +
      VALID_METHODS.join(', ') + ' but found ' + data.method);
  }

  if (!self.isEnrolled()) {
    throw new errors.InvalidStateError('Expected user to be enrolled');
  }

  return authVerificationStep(self.authStrategies[data.method], {
    loginCompleteHub: self.loginCompleteHub,
    loginRejectedHub: self.loginRejectedHub,
    transaction: self
  });
};

/**
 * @param {object} data
 * @param {otp|push|sms} data.method
 */
transaction.prototype.buildEnrollmentConfirmationStep =
  function buildEnrollmentConfirmationStep(data) {
    var self = this;

    if (typeof data !== 'object') {
      throw new errors.UnexpectedInputError('Expected data to be an object');
    }

    if (VALID_METHODS.indexOf(data.method) < 0) {
      throw new errors.UnexpectedInputError('Expected data.method to be one of ' +
        VALID_METHODS.join(', ') + ' but found ' + data.method);
    }

    if (!self.enrollmentAttempt) {
      throw new errors.InvalidStateError('Expected enrollment attempt to be present: ' +
        'try calling .enroll method first');
    }
    return enrollmentConfirmationStep({
      strategy: self.enrollmentStrategies[data.method],
      enrollmentAttempt: self.enrollmentAttempt,
      enrollmentCompleteHub: self.enrollmentCompleteHub,
      transaction: self
    });
  };

/**
 * @Public
 *
 * This methods return an object that represents the the inner state of the transaction. Is useful
 * to store some where this state and resume this transaction later.
 *
 * @returns {Object}
 *
 */
transaction.prototype.serialize = function serialize() {
  var self = this;

  function enrollmentSerialize(enrollment) {
    return enrollment.serialize();
  }

  var data = {
    transactionToken: this.transactionToken.getToken(),
    baseUrl: this.httpClient.getBaseUrl(),
    availableEnrollmentMethods: this.availableEnrollmentMethods,
    availableAuthenticationMethods: this.availableAuthenticationMethods
  };

  data.enrollments = object.map(this.enrollments, enrollmentSerialize);

  data.enrollmentAttempt = this.enrollmentAttempt
    ? this.enrollmentAttempt.serialize() : undefined;
  data.authVerificationStep = self.authVerificationStep
    ? self.authVerificationStep.serialize() : null;
  data.enrollmentConfirmationStep = self.enrollmentConfirmationStep
    ? self.enrollmentConfirmationStep.serialize() : null;

  return data;
};


transaction.prototype.getState = function getState(callback) {
  var self = this;

  return self.httpClient.post('/api/transaction-state',
    self.transactionToken,
    null,
    callback);
};

/**
 * @public
 *
 * Start an enrollment on this transaction
 */
transaction.prototype.enroll = function enroll(method, data, callback) {
  var self = this;

  if (self.isEnrolled()) {
    asyncHelpers.setImmediate(callback, new errors.AlreadyEnrolledError());
    return;
  }

  if (object.get(self, 'availableEnrollmentMethods', []).length === 0) {
    asyncHelpers.setImmediate(callback, new errors.NoMethodAvailableError());
    return;
  }

  if (!object.contains(self.availableEnrollmentMethods, method)) {
    asyncHelpers.setImmediate(callback, new errors.EnrollmentMethodDisabledError(method));
    return;
  }

  var strategy = self.enrollmentStrategies[method];

  if (!strategy) {
    asyncHelpers.setImmediate(callback, new errors.MethodNotFoundError(method));
    return;
  }

  self.enrollmentAttempt.setActive(true);
  self.eventSequencer.addSequence('local-enrollment', ['enrollment-complete', 'auth-response']);

  strategy.enroll(data, function onEnrollmentStarted(err) {
    if (err) {
      self.dismissEnrollmentAttempt();

      callback(err);
      return;
    }

    var confirmationStep = enrollmentConfirmationStep({
      strategy: strategy,
      transaction: self,
      enrollmentCompleteHub: self.enrollmentCompleteHub,
      enrollmentAttempt: self.enrollmentAttempt
    });

    self.enrollmentConfirmationStep = confirmationStep;

    confirmationStep.once('enrollment-complete', function onEnrollmentComplete(payload) {
      self.addEnrollment(payload.enrollment);
      self.eventSequencer.emit('enrollment-complete', payload);

      self.dismissEnrollmentAttempt();
    });

    confirmationStep.on('error', function onError(iErr) {
      self.dismissEnrollmentAttempt();

      self.eventSequencer.emit('error', iErr);
    });

    callback(null, confirmationStep);
    return;
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
  if (arguments.length === 2) {
    callback = options; // eslint-disable-line no-param-reassign
    options = {}; // eslint-disable-line no-param-reassign
  }

  options = options || {}; // eslint-disable-line no-param-reassign

  if (!this.isEnrolled()) {
    asyncHelpers.setImmediate(callback, new errors.NotEnrolledError());
    return;
  }

  if (!enrollment) {
    asyncHelpers.setImmediate(callback, new errors.InvalidEnrollmentError());
    return;
  }

  var availableMethods = enrollment.getAvailableMethods();

  if (!availableMethods) {
    asyncHelpers.setImmediate(callback, new errors.InvalidEnrollmentError());
    return;
  }

  if (!options.method) {
    options.method = availableMethods[0]; // eslint-disable-line no-param-reassign
  }

  if (object.get(this, 'availableAuthenticationMethods', []).length === 0) {
    asyncHelpers.setImmediate(callback, new errors.NoMethodAvailableError());
    return;
  }

  // only check if is contained, if not recovery-code; recovery code are always enabled.
  if (options.method !== 'recovery-code' &&
      !object.contains(this.availableAuthenticationMethods, options.method)) {
    asyncHelpers.setImmediate(callback, new errors.AuthMethodDisabledError(options.method));
    return;
  }

  var strategy = this.authStrategies[options.method];

  if (!strategy) {
    asyncHelpers.setImmediate(callback, new errors.MethodNotFoundError(options.method));
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
transaction.prototype.recover = function recover(data, cb) {
  var self = this;

  if (!this.isEnrolled()) {
    asyncHelpers.setImmediate(events.emitErrorOrCallback,
      new errors.NotEnrolledError(), self.eventSequencer, cb);
    return;
  }

  self.requestStrategyAuth(self.authRecoveryStrategy,
    function onRecoveryRequested(err, recoveryAuth) {
      if (err) {
        events.emitErrorOrCallback(err, self.eventSequencer, cb);
        return;
      }

      recoveryAuth.verify(data, cb);
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
 * @public
 */
transaction.prototype.getAvailableEnrollmentMethods = function getAvailableEnrollmentMethods() {
  return this.availableEnrollmentMethods;
};

/**
 * @private
 */
transaction.prototype.dismissEnrollmentAttempt = function dismissEnrollmentAttempt() {
  var self = this;

  self.eventSequencer.removeSequence('local-enrollment');
  self.enrollmentAttempt.setActive(false);
};

/**
 * @private
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
      callback(err);
      return;
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

    self.authVerificationStep = verificationStep;

    callback(null, verificationStep);
  });
};

transaction.prototype.getAuthVerificationStep = function getAuthVerificationStep() {
  var self = this;

  if (!self.authVerificationStep) {
    throw new errors.InvalidStateError('Cannot get enrollment confirmation ' +
    'step, you must call .requestAuth first');
  }

  return self.authVerificationStep;
};

transaction.prototype.getEnrollmentConfirmationStep = function getEnrollmentConfirmationStep() {
  var self = this;

  if (!self.enrollmentConfirmationStep) {
    throw new errors.InvalidStateError('Cannot get enrollment confirmation step, ' +
    'you must call .enroll first');
  }

  return self.enrollmentConfirmationStep;
};

module.exports = transaction;
