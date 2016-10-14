'use strict';

var object = require('../utils/object');

/**
 * @param {JWTToken} data.transactionToken
 * @param {HttpClient} options.httpClient
 */
function pnAuthenticatorStrategy(data, options) {
  var self = object.create(pnAuthenticatorStrategy.prototype);

  self.method = 'push';

  self.transactionToken = this.data.transactionToken;
  self.httpClient = options.httpClient;

  return self;
}

/**
 * Request login authorization (push notification). So it a request for the
 * push notification
 *
 * @public
 */
pnAuthenticatorStrategy.prototype.request = function request(callback) {
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
pnAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
  object.setImmediate(callback);
};

module.exports = pnAuthenticatorStrategy;
