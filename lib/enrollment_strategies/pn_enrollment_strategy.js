'use strict';

var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var enrollmentUriHelper = require('../utils/enrollment_uri_helper');

/**
 * @param {HttpClient} options.httpClient
 * @param {JWTToken} data.transactionToken
 * @param {EnrollmentAttempt} data.enrollmentAttempt
 * @param {{ name, label }} data.issuer
 */
function pnEnrollmentStrategy(data, options) {
  var self = object.create(pnEnrollmentStrategy.prototype);

  self.method = 'push';
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
pnEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
  asyncHelpers.setImmediate(callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
pnEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
  asyncHelpers.setImmediate(callback);
};

/**
 * Returns URI for authenticator / otp enrollment
 *
 * @public
 * @returns {string}
 */
pnEnrollmentStrategy.prototype.getUri = function getUri() {
  return enrollmentUriHelper(this.getData());
};

pnEnrollmentStrategy.prototype.getData = function getData() {
  return {
    issuerLabel: this.enrollmentAttempt.getIssuerLabel(),
    otpSecret: this.enrollmentAttempt.getOtpSecret(),
    enrollmentTransactionId: this.enrollmentAttempt.getEnrollmentTransactionId(),
    issuerName: this.enrollmentAttempt.getIssuerName(),
    enrollmentId: this.enrollmentAttempt.getEnrollmentId(),
    baseUrl: this.enrollmentAttempt.getBaseUri(),
    algorithm: 'sha1',
    digits: 6,
    counter: 0,
    period: 30
  };
};

module.exports = pnEnrollmentStrategy;
