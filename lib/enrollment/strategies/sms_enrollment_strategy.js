'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');

module.exports = class SMSEnrollmentStrategy {
  /**
   * @param {string} data.enrollment.id
   * @param {string} data.transactionToken
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Starts sms enrollment
   *
   * @param {string} enrollmentData.phoneNumber
   */
  enroll(enrollmentData) {
    if (!enrollmentData.phoneNumber) {
      return Promise.reject(new errors.FieldRequiredError('phoneNumber'));
    }

    return this.guardianClient.post(
      urlJoin('/device-accounts', encodeURIComponent(this.data.enrollment.id), '/sms-enroll'),
      this.data.transactionToken,
      enrollmentData);
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
};
