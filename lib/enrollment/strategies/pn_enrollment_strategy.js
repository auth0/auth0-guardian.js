'use strict';

const urlJoin = require('url-join');

module.exports = class PNEnrollmentStrategy {
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Starts sms enrollment
   *
   * @param {string} enrollmentData.pushCredentials
   * @param {string} enrollmentData.name
   * @param {string} enrollmentData.identifier
   */
  enroll(enrollmentData) {
    return this.guardianClient.patch(
      urlJoin('/device-accounts', this.data.enrollment.id),
      this.data.transactionToken,
      enrollmentData);
  }

  /**
   * Operation not allowed
   */
  confirm(verificationData) {
    throw new errors.OperationNotAllowedError();
  }

  getUri() {

  }
};
