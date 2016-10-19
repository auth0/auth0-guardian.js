'use strict';

const errors = require('../../errors');
const Promise = require('promise-polyfill');
const validations = require('../../utils/validations');

module.exports = class ManualAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {string} [configuration.factor]
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = (configuration && configuration.factor) || 'otp';

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * NOOP just to keep a consistent public API
   *
   * @public
   */
  request() {
    return Promise.resolve();
  }

  /**
   * Confirms the enrollment
   *
   * @public
   * @param {string} verificationData.otpCode
   */
  verify(verificationData) {
    if (!verificationData || !verificationData.otpCode) {
      return Promise.reject(new errors.FieldRequiredError('otpCode'));
    }

    if (!validations.validateOtp(verificationData.otpCode)) {
      return Promise.reject(new errors.OTPValidationError());
    }

    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken,
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }
};
