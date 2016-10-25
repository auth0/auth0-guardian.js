'use strict';

var object = require('../utils/object');
var async = require('../utils/async');
var errors = require('../errors');
var validations = require('../utils/validations');

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
  async.setImmediate(callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
authenticatorEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
  if (!data.otpCode) {
    async.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
    return;
  }

  if (!validations.validateOtp(data.otpCode)) {
    async.setImmediate(callback, new errors.OTPValidationError());
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
  return 'otpauth://totp/' + encodeURIComponent(this.enrollmentAttempt.getIssuerLabel()) +
    '?secret=' + encodeURIComponent(this.enrollmentAttempt.getOtpSecret());
};

module.exports = authenticatorEnrollmentStrategy;
