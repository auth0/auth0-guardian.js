'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class PNAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {GuardianSocket} dependencies.socket
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = 'push';

    this.guardianClient = dependencies.guardianClient;
    this.socket = dependencies.socket;
  }

  /**
   * Request login authorization (push notification)
   */
  request() {
    return this.guardianClient.post(
      '/send-push-notification', this.data.transactionToken.getToken());
  }

  /**
   * @param {function} cb on completion callback
   */
  onCompletion(cb) {
    const onComplete = (payload) => {
      this.socket.removeListener('login-rejected', onReject);

      const completionPayload = {
        factor: 'push',
        recovery: false,
        accepted: true,
        loginPayload: payload
      };

      cb(completionPayload);
    };

    const onReject = () => {
      this.socket.removeListener('login-complete', onComplete);

      const rejectionPayload = {
        factor: 'push',
        recovery: false,
        accepted: false,
        loginPayload: null
      };

      cb(rejectionPayload);
    };

    this.socket.once('login-complete', onComplete);
    this.socket.once('login-rejected', onReject);

    return this;
  }

  verify() {
    return Promise.resolve();
  }
};
