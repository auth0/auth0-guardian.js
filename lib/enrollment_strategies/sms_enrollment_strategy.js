'use strict';

var url = require('../utils/url');
var object = require('../utils/object');
var errors = require('../errors');
var asyncHelpers = require('../utils/async');
var validations = require('../utils/validations');

/**
 * @param {HttpClient} options.httpClient
 * @param {JWTToken} data.transactionToken
 * @param {EnrollmentAttempt} data.enrollmentAttempt
 */
function smsEnrollmentStrategy(data, options) {
  var self = object.create(smsEnrollmentStrategy.prototype);

  self.method = 'sms';
  self.enrollmentAttempt = data.enrollmentAttempt;
  self.transactionToken = data.transactionToken;
  self.httpClient = options.httpClient;

  return self;
}

/**
 * Starts sms enrollment
 *
 * @public
 * @param {string} data.phoneNumber
 */
smsEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
  if (!data.phoneNumber) {
    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('phoneNumber'));
    return;
  }

  this.httpClient.post(
    url.join('api/device-accounts',
      encodeURIComponent(this.enrollmentAttempt.getEnrollmentId()), '/sms-enroll'),
    this.transactionToken,
    { phone_number: data.phoneNumber },
    callback);
};

/**
 * Confirms the enrollment
 *
 * @public
 * @param {string} data.otpCode
 */
smsEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
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
 * NOOP (returns null) just to keep public API consistent
 */
smsEnrollmentStrategy.prototype.getUri = function getUri() {
  return null;
};

module.exports = smsEnrollmentStrategy;
