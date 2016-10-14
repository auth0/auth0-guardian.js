'use strict';

var object = require('../utils/object');

/**
 * @param {JWTToken} data.transactionToken
 */
function pnAuthenticatorStrategy(data, options) {
  var self = object.create(smsAuthenticatorStrategy.prototype);

  self.method = 'push';

  self.transactionToken = this.data.transactionToken;
  self.httpClient = options.dependencies.httpClient;

  return self;
}

/**
 * Request login authorization (push notification). So it a request for the
 * push notification
 *
 * @public
 */
pnAuthenticatorStrategy.prototype.request = function(callback) {
  return this.httpClient.post(
      '/send-push-notification',
      this.transactionToken.getToken(),
      callback);
};

/**
 * NOOP just to keep a consistent public API
 *
 * @public
 */
pnAuthenticatorStrategy.prototype.verify = function(data, callback) {
  object.setImmediate(callback);
};

module.exports = pnAuthenticatorStrategy;
