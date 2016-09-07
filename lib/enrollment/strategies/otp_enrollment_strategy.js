'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class AuthenticatorEnrollmentStrategy {
  /**
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.issuer.label
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
      this.data.transactionToken.getToken(),
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }

  onCompletion(cb) {
    this.socket.on('login-complete', (loginPayload) => {
      cb({
        factor: 'otp',
        enrollment: { status: 'confirmed' },
        transactionComplete: true,
        loginPayload: loginPayload
      });
    });

    return this;
  }

  getUri() {
    return `otpauth://totp/${encodeURIComponent(`${this.data.issuer.label}`)}` +
      `?secret=${encodeURIComponent(this.data.enrollment.otpSecret)}`;
  }
};
