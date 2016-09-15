'use strict';

const errors = require('../../errors');
const OTPAuthenticatorStrategy = require('./otp_authenticator_strategy');

module.exports = class SMSAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
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
      guardianClient: this.guardianClient
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

  transformLoginCompletion(data) {
    return this.otpAuthenticatorStrategy.transformLoginCompletion(data);
  }

  transformLoginRejection() {
    throw new errors.NotValidStateError('Received rejection for ' +
      'sms auth strategy'); // Does not apply
  }
};
