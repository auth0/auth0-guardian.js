'use strict';

var object = require('../utils/object');

/**
 * Represents a not-yet-complete enrollment; once it is complete an enrollment
 * will be created instead
 *
 * @param {string} data.enrollmentTxId
 * @param {string} data.otpSecret
 * @param {string} data.issuer.name
 * @param {string} data.issuer.label
 * @param {string} data.recoveryCode
 * @param {string} data.baseUrl
 * @param {string} data.enrollmentId
 *
 * @private
 */
function enrollmentAttempt(data) {
  var self = object.create(enrollmentAttempt.prototype);

  self.data = data;

  return self;
}

/**
 * @returns {string} Returns enrollment transaction id to send to the device as part of the qr
 *  for Guardian enrollment
 */
enrollmentAttempt.prototype.getEnrollmentTransactionId = function getEnrollmentTransactionId() {
  return this.data.enrollmentTxId;
};

/**
 * @returns {string} Returns shared secret to include in the QR
 */
enrollmentAttempt.prototype.getOtpSecret = function getOtpSecret() {
  return this.data.otpSecret;
};

/**
 * @returns {string} Returns issuer identifier for the enrollment in the device. It is usually
 *   tenant name
 */
enrollmentAttempt.prototype.getIssuerName = function getIssuerName() {
  return this.data.issuer.name;
};

/**
 * @returns {string} Returns issuer name for the enrollment in the device. It is usually
 *   tenant's friendly name
 */
enrollmentAttempt.prototype.getIssuerLabel = function getIssuerLabel() {
  return this.data.issuer.label;
};

/**
 * @returns {string} Returns recovery code for enrollment attempt (if any)
 */
enrollmentAttempt.prototype.getRecoveryCode = function getRecoveryCode() {
  return this.data.recoveryCode;
};

/**
 * @param {sms|push|otp} method
 *
 * @returns {boolean} Return true if the transaction needs a separate authentication
 */
enrollmentAttempt.prototype.isAuthRequired = function isAuthRequired(method) {
  return method === 'push';
};

enrollmentAttempt.prototype.getEnrollmentId = function getEnrollmentId() {
  return this.data.enrollmentId;
};

enrollmentAttempt.prototype.getBaseUri = function getBaseUri() {
  return this.data.baseUrl;
};

module.exports = enrollmentAttempt;
