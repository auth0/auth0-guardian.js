'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');

module.exports = class RecoveryCodeAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  request() {
    return Promise.reject(new errors.OperationNotAllowedError());
  }

  /**
   * Account login using recovery code
   *
   * @param {string} verificationData.recoveryCode
   */
  verify(verificationData) {
    if (!verificationData || !verificationData.recoveryCode) {
      return Promise.reject(new errors.FieldRequiredError('otpCode'));
    }

    return this.guardianClient.post(
      '/recover-account',
      this.data.transactionToken,
      { recoveryCode: verificationData.recoveryCode });
  }
};
