'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class PNEnrollmentStrategy {
  /**
   * @param {string} data.tenant.name
   * @param {string} data.tenant.friendlyName
   * @param {string} data.enrollment.id
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.enrollmentTxId
   *
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Operation not allowed
   */
  enroll(enrollmentData) {
    return Promise.resolve();
  }

  /**
   * Operation not allowed
   */
  confirm(verificationData) {
    return Promise.resolve();
  }

  getUri() {
    return `otpauth://totp/${encodeURIComponent(this.data.tenant.name)}:` +
      `${encodeURIComponent(this.data.tenant.friendlyName)}` +
      `?secret=${encodeURIComponent(this.data.enrollment.otpSecret)}` +
      `&enrollment_tx_id=${encodeURIComponent(this.data.enrollmentTxId)}` +
      `&issuer=${encodeURIComponent(this.data.tenant.name)}` +
      `&id=${encodeURIComponent(this.data.enrollment.id)}` +
      `&base_url=${encodeURIComponent(this.guardianClient.getBaseUri())}` +
      `&algorithm=sha1&digits=6&counter=0&period=30`;
  }
};
