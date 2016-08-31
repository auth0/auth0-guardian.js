'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const ManualAuthenticatorStrategy = require('./manual_authenticator_strategy');

module.exports = class SMSAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;

    this.manualAuthenticatorStrategy = new ManualAuthenticatorStrategy({
      transactionToken: data.transactionToken
    }, null, {
      guardianClient: this.guardianClient
    });
  }

  /**
   * Request login authorization (sms)
   */
  request() {
    return this.guardianClient.post(
      '/send-sms', this.data.transactionToken);
  }


  /**
   * @param {string} verificationData.otpCode
   */
  verify(verificationData) {
    return this.manualAuthenticatorStrategy.verify(verificationData);
  }
};
