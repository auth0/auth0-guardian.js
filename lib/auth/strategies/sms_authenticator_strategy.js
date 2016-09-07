'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const OTPAuthenticatorStrategy = require('./otp_authenticator_strategy');

module.exports = class SMSAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {GuardianSocket} dependencies.socket
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = 'sms';

    this.guardianClient = dependencies.guardianClient;
    this.socket = dependencies.socket;

    this.otpAuthenticatorStrategy = new OTPAuthenticatorStrategy({
      transactionToken: data.transactionToken
    }, { factor: this.factor }, {
      guardianClient: this.guardianClient,
      socket: this.socket
    });
  }

  /**
   * Request login authorization (sms)
   */
  request() {
    return this.guardianClient.post(
      '/send-sms', this.data.transactionToken.getToken());
  }

  /**
   * @param {string} verificationData.otpCode
   */
  verify(verificationData) {
    return this.otpAuthenticatorStrategy.verify(verificationData);
  }

  /**
   * @param {function} cb on completion callback
   */
  onCompletion(cb) {
    this.otpAuthenticatorStrategy.onCompletion(cb);

    return this;
  }
};
