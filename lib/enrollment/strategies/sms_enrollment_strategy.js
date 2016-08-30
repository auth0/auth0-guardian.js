'use strict';

const urlJoin = require('url-join');

module.exports = class SMSEnrollmentStrategy {
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
    return this.guardianClient.post(
      urlJoin('/device-accounts', this.data.enrollment.id, '/sms-enroll'),
      this.data.transactionToken,
      enrollmentData);
  }

  /**
   * Confirms the enrollment
   *
   * @param {string} verificationData.otpCode
   */
  confirm(verificationData) {
    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken,
      { otpCode: verificationData.otpCode });
  }
};
