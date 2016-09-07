'use strict';

const urlJoin = require('url-join');
const errors = require('../../errors');
const Promise = require('bluebird');

module.exports = class PNEnrollmentStrategy {
  /**
   * @param {string} data.issuer.name
   * @param {string} data.issuer.label
   * @param {string} data.enrollment.id
   * @param {string} data.enrollment.otpSecret
   * @param {string} data.enrollmentTxId
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

  onCompletion(cb) {
    this.socket.on('enrollment-complete', (payload) => {
      cb({
        factor: 'push',
        enrollment: { name: payload.enrollment.name, status: 'confirmed' },
        transactionComplete: false,
        loginPayload: null
      });
    });

    return this;
  }

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
