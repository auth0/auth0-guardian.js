'use strict';

var errors = require('../errors');
var object = require('../utils/object');
var validations = require('../utils/validations');
var async = require('../utils/async');

/**
 * @param {JWTToken} data.transactionToken
 * @param {HttpClient} options.httpClient
 */
function recoveryAuthenticatorStrategy(data, options) {
  var self = object.create(recoveryAuthenticatorStrategy.prototype);

  self.method = data.method || 'sms';

  self.transactionToken = data.transactionToken;
  self.httpClient = options.httpClient;

  return self;
}

recoveryAuthenticatorStrategy.prototype.request = function request(callback) {
  async.setImmediate(callback);
};

  /**
   * Account login using recovery code
   *
   * @param {string} data.recoveryCode
   */
recoveryAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
  if (!data || !data.recoveryCode) {
    return async.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
  }

  if (!validations.validateRecoveryCode(data.recoveryCode)) {
    return async.setImmediate(callback, new errors.RecoveryCodeValidationError());
  }

  return this.httpClient.post(
    'api/recover-account',
    this.transactionToken.getToken(),
    { recovery_code: data.recoveryCode },
    callback);
};

module.exports = recoveryAuthenticatorStrategy;
