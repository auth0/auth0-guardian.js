'use strict';

var object = require('../utils/object');
var async = require('../utils/async');

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
  async.setImmediate(callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
pnEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
  async.setImmediate(callback);
};

/**
 * Returns URI for authenticator / otp enrollment
 *
 * @public
 * @returns {string}
 */
pnEnrollmentStrategy.prototype.getUri = function getUri() {
  return 'otpauth://totp/' + encodeURIComponent(this.enrollmentAttempt.getIssuerLabel()) +
    '?secret=' + encodeURIComponent(this.enrollmentAttempt.getOtpSecret()) +
    '&enrollment_tx_id=' + encodeURIComponent(this.enrollmentAttempt.getEnrollmentTransactionId()) +
    '&issuer=' + encodeURIComponent(this.enrollmentAttempt.getIssuerName()) +
    '&id=' + encodeURIComponent(this.enrollmentAttempt.getEnrollmentId()) +
    '&base_url=' + encodeURIComponent(this.enrollmentAttempt.getBaseUri()) +
    '&algorithm=sha1&digits=6&counter=0&period=30';
};

module.exports = pnEnrollmentStrategy;
