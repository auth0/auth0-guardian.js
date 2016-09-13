'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('promise-polyfill');

module.exports = class PNAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = 'push';

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Request login authorization (push notification). So it a request for the
   * push notification
   *
   * @public
   */
  request() {
    return this.guardianClient.post(
      '/send-push-notification', this.data.transactionToken.getToken());
  }

  /**
   * NOOP just to keep a consistent public API
   *
   * @public
   */
  verify() {
    return Promise.resolve();
  }
};
