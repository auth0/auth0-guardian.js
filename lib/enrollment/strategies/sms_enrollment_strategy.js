'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class SMSEnrollmentStrategy {
  /**
   * @param {string} data.enrollment.id
   * @param {string} data.transactionToken
   *
   * @param {GuardianSocket} dependencies.socket
   * @param {EventEmitter} dependencies.hub
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.socket = dependencies.socket;
    this.hub = dependencies.hub;
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
      this.data.transactionToken.getToken(),
      enrollmentData);
  }

  onCompletion(cb) {
    this.socket.on('login-complete', (loginPayload) => {
      cb({
        factor: 'sms',
        enrollment: { status: 'confirmed' },
        transactionComplete: true,
        loginPayload: loginPayload
      });
    });

    return this;
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
      this.data.transactionToken.getToken(),
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }

  getUri() {
    return null;
  }
};
