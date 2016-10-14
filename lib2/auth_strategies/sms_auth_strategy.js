'use strict';

var object = require('../utils/object');

/**
 * @param {JWTToken} data.transactionToken
 */
function smsAuthenticatorStrategy(data, options) {
  var self = object.create(smsAuthenticatorStrategy.prototype);

  self.method = 'sms';

  self.transactionToken = this.data.transactionToken;
  self.httpClient = options.dependencies.httpClient;

  self.smsAuthenticatorStrategy = otpAuthenticatorStrategy({
    transactionToken: transactionToken,
    method: self.method
  }, {
    dependencies: {
      httpClient: self.httpClient
    }
  });

  return self;
}

smsAuthenticatorStrategy.prototype.request = function(callback) {
  this.httpClient.post('/send-sms', this.transactionToken.getToken(), callback);
};

smsAuthenticatorStrategy.prototype.verify = function(data, callback) {
  this.otpAuthenticatorStrategy.verify(data, callback);
};

module.exports = smsAuthenticatorStrategy;
