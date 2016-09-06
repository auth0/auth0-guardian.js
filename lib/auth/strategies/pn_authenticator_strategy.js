'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class PNAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = 'push';

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Request login authorization (push notification)
   */
  request() {
    return this.guardianClient.post(
      '/send-push-notification', this.data.transactionToken.getToken());
  }


  verify() {
    return Promise.resolve();
  }
};
