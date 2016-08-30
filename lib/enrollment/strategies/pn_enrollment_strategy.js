'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');

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
   * Starts pn enrollment
   *
   * @param {string} enrollmentData.pushCredentials.service
   * @param {string} enrollmentData.pushCredentials.token
   * @param {string} enrollmentData.name
   * @param {string} enrollmentData.identifier
   */
  enroll(enrollmentData) {
    if (!enrollmentData.pushCredentials) {
      return Promise.reject(new errors.FieldRequiredError('pushCredentials'));
    }

    if (!enrollmentData.pushCredentials.service) {
      return Promise.reject(new errors.FieldRequiredError('pushCredentials.service'));
    }

    if (!enrollmentData.pushCredentials.token) {
      return Promise.reject(new errors.FieldRequiredError('pushCredentials.token'));
    }

    if (!enrollmentData.name) {
      return Promise.reject(new errors.FieldRequiredError('name'));
    }

    if (!enrollmentData.identifier) {
      return Promise.reject(new errors.FieldRequiredError('identifier'));
    }

    return this.guardianClient.patch(
      urlJoin('/device-accounts', this.data.enrollment.id),
      this.data.transactionToken,
      enrollmentData);
  }

  /**
   * Operation not allowed
   */
  confirm(verificationData) {
    return Promise.reject(new errors.OperationNotAllowedError());
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
