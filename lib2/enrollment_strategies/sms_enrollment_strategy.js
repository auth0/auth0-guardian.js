'use strict';

var url = require('../utils/url');
var object = require('../utils/object');
var errors = require('../../errors');

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
    return object.setImmediate(callback, new errors.FieldRequiredError('phoneNumber'));
  }

  return this.httpClient.post(
    url.join('/device-accounts',
      encodeURIComponent(this.enrollmentAttempt.getEnrollmentId()), '/sms-enroll'),
    this.transactionToken.getToken(),
    data,
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
    return object.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
  }

  return this.httpClient.post(
    '/verify-otp',
    this.transactionToken.getToken(), {
      type: 'manual_input',
      code: data.otpCode
    });
};

/**
 * NOOP (returns null) just to keep public API consistent
 */
smsEnrollmentStrategy.prototype.getUri = function getUri() {
  return null;
};
