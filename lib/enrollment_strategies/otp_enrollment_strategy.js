'use strict';

var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var errors = require('../errors');
var validations = require('../utils/validations');
var enrollmentUriHelper = require('../utils/enrollment_uri_helper');

/**
 * @param {HttpClient} options.httpClient
 * @param {JWTToken} data.transactionToken
 * @param {EnrollmentAttempt} data.enrollmentAttempt
 */
function authenticatorEnrollmentStrategy(data, options) {
  var self = object.create(authenticatorEnrollmentStrategy.prototype);

  self.method = 'otp';
  self.enrollmentAttempt = data.enrollmentAttempt;
  self.transactionToken = data.transactionToken;
  self.httpClient = options.httpClient;

  return self;
}

/**
 * NOOP Method, just to keep a consistent public API
 *
 * @public
 */
authenticatorEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
  asyncHelpers.setImmediate(callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
authenticatorEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
  if (!data.otpCode) {
    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
    return;
  }

  if (!validations.validateOtp(data.otpCode)) {
    asyncHelpers.setImmediate(callback, new errors.OTPValidationError());
    return;
  }

  this.httpClient.post(
    'api/verify-otp',
    this.transactionToken, {
      type: 'manual_input',
      code: data.otpCode
    },
    callback);
};

/**
 * Returns URI for authenticator / otp enrollment
 *
 * @public
 * @returns {string}
 */
authenticatorEnrollmentStrategy.prototype.getUri = function getUri() {
  return enrollmentUriHelper(this.getData());
};

authenticatorEnrollmentStrategy.prototype.getData = function getData() {
  return {
    issuerLabel: this.enrollmentAttempt.getIssuerLabel(),
    otpSecret: this.enrollmentAttempt.getOtpSecret(),
    accountLabel: this.enrollmentAttempt.getAccountLabel()
  };
};

module.exports = authenticatorEnrollmentStrategy;
