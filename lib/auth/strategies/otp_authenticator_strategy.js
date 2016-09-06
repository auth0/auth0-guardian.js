'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class ManualAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = 'otp';

    this.guardianClient = dependencies.guardianClient;
  }

  request() {
    return Promise.resolve();
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
      this.data.transactionToken.getToken(),
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }
};
