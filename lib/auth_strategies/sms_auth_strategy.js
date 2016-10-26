'use strict';

var object = require('../utils/object');
var otpAuthenticatorStrategy = require('./otp_auth_strategy');

/**
 * @param {JWTToken} data.transactionToken
 * @param {HttpClient} options.httpClient
 */
function smsAuthenticatorStrategy(data, options) {
  var self = object.create(smsAuthenticatorStrategy.prototype);

  self.method = 'sms';

  self.transactionToken = data.transactionToken;
  self.httpClient = options.httpClient;

  self.otpAuthenticatorStrategy = otpAuthenticatorStrategy({
    transactionToken: data.transactionToken,
    method: self.method
  }, {
    httpClient: self.httpClient
  });

  return self;
}

smsAuthenticatorStrategy.prototype.request = function request(callback) {
  this.httpClient.post('api/send-sms', this.transactionToken, null, callback);
};

smsAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
  this.otpAuthenticatorStrategy.verify(data, callback);
};

module.exports = smsAuthenticatorStrategy;
