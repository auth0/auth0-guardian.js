'use strict';

var errors = require('../errors');
var object = require('../utils/object');
var validations = require('../utils/validations');

/**
 * @param {JWTToken} data.transactionToken
 */
function otpAuthenticatorStrategy(data, options) {
  var self = object.create(smsAuthenticatorStrategy.prototype);

  self.method = data.method || 'sms';

  self.transactionToken = this.data.transactionToken;
  self.httpClient = options.dependencies.httpClient;

  return self;
}

otpAuthenticatorStrategy.prototype.request = function(callback) {
  object.setImmediate(callback);
};

otpAuthenticatorStrategy.prototype.verify = function(data, callback) {
    if (!data || !data.otpCode) {
      return object.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
    }

    if (!validations.validateOtp(data.otpCode)) {
      return object.setImmediate(callback, new errors.OTPValidationError());
    }

    return this.httpClient.post(
      '/verify-otp',
      this.transactionToken.getToken(), {
        type: 'manual_input',
        code: data.otpCode
      },
      callback);
};

module.exports = otpAuthenticatorStrategy;
