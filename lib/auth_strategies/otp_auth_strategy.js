'use strict';

var errors = require('../errors');
var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var validations = require('../utils/validations');

/**
 * @param {JWTToken} data.transactionToken
 * @param {number} [data.otpLength] Expected number of digits for the OTP code.
 *  Defaults to 6 when omitted.
 * @param {HttpClient} options.httpClient
 */
function otpAuthenticatorStrategy(data, options) {
  var self = object.create(otpAuthenticatorStrategy.prototype);

  self.method = data.method || 'otp';

  self.transactionToken = data.transactionToken;
  self.otpLength = data.otpLength;
  self.httpClient = options.httpClient;

  return self;
}

otpAuthenticatorStrategy.prototype.request = function request(callback) {
  asyncHelpers.setImmediate(callback);
};

otpAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
  if (!data || !data.otpCode) {
    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
    return;
  }

  if (!validations.validateOtp(data.otpCode, this.otpLength)) {
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

module.exports = otpAuthenticatorStrategy;
