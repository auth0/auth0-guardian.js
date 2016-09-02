'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class AuthenticatorEnrollmentStrategy {
  /**
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.tenant.name
   * @param {string} data.tenant.friendlyName
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Starts authenticator enrollment
   *
   * @param {string} enrollmentData.phoneNumber
   */
  enroll(/* enrollmentData */) {
    return Promise.resolve();
  }

  /**
   * Confirms the enrollment
   *
   * @param {string} verificationData.otpCode
   */
  confirm(verificationData) {
    if (!verificationData.otpCode) {
      return Promise.reject(new errors.FieldRequiredError('otpCode'));
    }

    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken,
      { otpCode: verificationData.otpCode });
  }

  getUri() {
    return `otpauth://totp/${encodeURIComponent(`${this.data.tenant.name}:${this.data.tenant.friendlyName}`)}` +
      `?secret=${encodeURIComponent(this.data.enrollment.otpSecret)}`;
  }
};
