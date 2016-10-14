'use strict';

var object = require('../utils/object');
var errors = require('../../errors');

/**
 * @param {HttpClient} options.dependencies.httpClient
 * @param {JWTToken} data.transactionToken
 * @param {EnrollmentAttempt} data.enrollmentAttempt
 * @param {{ name, label }} data.issuer
 */
function authenticatorEnrollmentStrategy(data, options) {
  var self = object.create(authenticatorEnrollmentStrategy.prototype);

  self.method = 'otp';
  self.enrollmentAttempt = data.enrollmentAttempt;
  self.transactionToken = data.transactionToken;
  self.httpClient = options.dependencies.httpClient;

  return self;
}

/**
 * NOOP Method, just to keep a consistent public API
 *
 * @public
 */
authenticatorEnrollmentStrategy.prototype.enroll = function enroll(callback) {
  object.setImmediate(callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
authenticatorEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
  if (!data.otpCode) {
    return object.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
  }

  return this.httpClient.post(
    '/verify-otp',
    this.transactionToken.getToken(), {
      type: 'manual_input',
      code: data.otpCode
    }, callback);
};

/**
 * Returns URI for authenticator / otp enrollment
 *
 * @public
 * @returns {string}
 */
authenticatorEnrollmentStrategy.prototype.getUri = function getUri() {
  return 'otpauth://totp/' + encodeURIComponent(this.issuer.label) +
    '?secret=' + encodeURIComponent(this.enrollment.otpSecret);
};
