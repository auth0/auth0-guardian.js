'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');

module.exports = class ManualAuthenticatorStrategy {
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
   * Confirms the enrollment
   *
   * @param {string} verificationData.otpCode
   */
  verify(verificationData) {
    if (!verificationData || !verificationData.otpCode) {
      return Promise.reject(new errors.FieldRequiredError('otpCode'));
    }

    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken,
      { otpCode: verificationData.otpCode });
  }
};
