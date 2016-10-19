'use strict';

const errors = require('../../errors');
const Promise = require('promise-polyfill');
const validations = require('../../utils/validations');

module.exports = class RecoveryCodeAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = null;

    this.guardianClient = dependencies.guardianClient;
  }

  request() {
    return Promise.resolve();
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

    if (!validations.validateRecoveryCode(verificationData.recoveryCode)) {
      return Promise.reject(new errors.RecoveryCodeValidationError());
    }

    return this.guardianClient.post(
      '/recover-account',
      this.data.transactionToken,
      { recoveryCode: verificationData.recoveryCode });
  }

  transformLoginCompletion(loginPayload) {
    return {
      factor: null,
      recovery: true,
      accepted: true,
      transactionComplete: true,
      loginPayload
    };
  }

  transformLoginRejection() {
    throw new errors.NotValidStateError('Received rejection for ' +
      'recovery auth strategy'); // Does not apply
  }
};
