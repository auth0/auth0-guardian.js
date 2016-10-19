'use strict';

const errors = require('../../errors');
const Promise = require('promise-polyfill');

module.exports = class AuthenticatorEnrollmentStrategy {
  /**
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.issuer.label
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.factor = 'otp';
    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * NOOP Method, just to keep a consistent public API
   *
   * @public
   */
  enroll() {
    return Promise.resolve();
  }

  /**
   * Confirms the enrollment
   *
   * @public
   * @param {string} verificationData.otpCode
   */
  confirm(verificationData) {
    if (!verificationData.otpCode) {
      return Promise.reject(new errors.FieldRequiredError('otpCode'));
    }

    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken,
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }

  /**
   * Returns URI for authenticator / otp enrollment
   *
   * @public
   * @returns {string}
   */
  getUri() {
    return `otpauth://totp/${encodeURIComponent(`${this.data.issuer.label}`)}` +
      `?secret=${encodeURIComponent(this.data.enrollment.otpSecret)}`;
  }
};
