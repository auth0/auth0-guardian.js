'use strict';

const errors = require('../../errors');
const Promise = require('promise-polyfill');

module.exports = class PNEnrollmentStrategy {
  /**
   * @param {string} data.issuer.name
   * @param {string} data.issuer.label
   * @param {string} data.enrollment.id
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.enrollmentTxId
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.factor = 'push';
    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * NOOP just to keep a consistent public API
   *
   * @public
   */
  enroll(enrollmentData) {
    return Promise.resolve();
  }

  /**
   * NOOP just to keep a consistent public API
   *
   * @public
   */
  confirm(verificationData) {
    return Promise.resolve();
  }

  /**
   * Returns enrollment uri for GuardianClient
   *
   * @public
   * @returns {string}
   */
  getUri() {
    return `otpauth://totp/${encodeURIComponent(this.data.issuer.label)}` +
      `?secret=${encodeURIComponent(this.data.enrollment.otpSecret)}` +
      `&enrollment_tx_id=${encodeURIComponent(this.data.enrollmentTxId)}` +
      `&issuer=${encodeURIComponent(this.data.issuer.name)}` +
      `&id=${encodeURIComponent(this.data.enrollment.id)}` +
      `&base_url=${encodeURIComponent(this.guardianClient.getBaseUri())}` +
      `&algorithm=sha1&digits=6&counter=0&period=30`;
  }
};
