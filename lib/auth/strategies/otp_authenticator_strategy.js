'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');
const validations = require('../../utils/validations');

module.exports = class ManualAuthenticatorStrategy {
  /**
   * @param {string} data.transactionToken
   *
   * @param {string} [configuration.factor]
   *
   * @param {GuardianSocket} dependencies.socket
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;
    this.factor = configuration && configuration.factor || 'otp';

    this.guardianClient = dependencies.guardianClient;
    this.socket = dependencies.socket;
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

    if (!validations.validateOtp(verificationData.otpCode)) {
      return Promise.reject(new errors.OTPValidationError());
    }

    return this.guardianClient.post(
      '/verify-otp',
      this.data.transactionToken.getToken(),
      {
        type: 'manual_input',
        code: verificationData.otpCode
      });
  }

  /**
   * @param {function} cb on completion callback
   */
  onCompletion(cb) {
    this.socket.on('login-complete', (payload) => {
      const completionPayload = {
        factor: this.factor,
        recovery: false,
        accepted: true,
        loginPayload: payload
      };

      cb(completionPayload);
    });

    return this;
  }
};
