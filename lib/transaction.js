'use strict';

const errors = require('./errors');
const EventEmitter = require('events').EventEmitter;
const AuthFlow = require('./auth/auth_flow');
const EnrollmentFlow = require('./enrollment/enrollment_flow');
const enrollment = require('./entities/enrollment');
const factor = require('./entities/factor');
const some = require('lodash.some');
const assign = require('lodash.assign');

/**
 * Represents an MFA transaction on Guardian. In order to support the
 * already planned "multidevice" feature we will leave enrollment as
 * a completely isolated action
 *
 * Enrollment flow is separated from Auth flow since in future we might be able
 * to execute them independenty to enroll more than on device
 */
class Transaction {

  /**
   * @param {object} data.enrollment
   * @param {string} data.enrollmentTxId
   * @param {string} data.transactionToken
   * @param {string} data.recoveryCode
   *
   * @param {boolean} data.factors.sms.enabled
   * @param {boolean} data.factors.push.enabled
   *
   * @param {EventEmitter} dependencies.hub
   * @param {GuardianSocket} dependencies.guardianSocket
   * @param {object} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.dependencies = dependencies;

    this.hub = dependencies.hub;
    this.guardianClient = this.dependencies.guardianClient;
    this.socket = this.dependencies.guardianSocket;
  }

  startListeningEvents() {
    this.socket.open(this.data.transactionToken.getToken());

    return this;
  }

  /**
   * Returns true if there is, at least, one device enrolled.
   */
  isEnrolled() {
    return enrollment.isEnrollmentConfirmed(this.data.enrollment);
  }

  /**
   * Returns true if user can enroll
   */
  canEnroll() {
    // Until we support multidevice enrollment is hightly tied to
    // being unenrolled
    return !this.isEnrolled();
  }

  /**
   * Convenience method to start authentication
   */
  startAuthForDefaultFactor() {
    return this.startAuth().forDefaultFactor();
  }

  /**
   * Starts an authentication flow
   *
   * @returns AuthenticatorFlow
   */
  startAuth() {
    if (!this.isEnrolled()) {
      throw new errors.NotEnrolledError();
    }

    this.startListeningEvents();

    this.hub.once('login-complete', () => this.end());

    const flow = new AuthFlow({
        transactionToken: this.data.transactionToken,
        enrollment: this.data.enrollment,
        factors: this.data.factors
      }, null, {
        guardianClient: this.guardianClient,
        socket: this.socket,
        hub: this.hub
      });

    return flow;
  }

  /**
   * Starts an enrollment flow
   *
   * @returns EnrollmentFlow
   * @throws
   *  EnrollNotAllowedError: When you are already enrolled an multidevice
   *    is not supported
   */
  startEnrollment() {
    if (!this.canEnroll()) {
      throw new errors.EnrollmentNotAllowedError();
    }

    this.startListeningEvents();

    this.hub.once('login-complete', () => this.end());
    this.hub.once('enrollment-complete', payload => {
      assign(this.data.enrollment, payload.enrollment);
    });

    const flow = new EnrollmentFlow({
        issuer: this.data.issuer,
        transactionToken: this.data.transactionToken,
        enrollmentTxId: this.data.enrollmentTxId,

        enrollment: this.data.enrollment,

        // Recovery code will be a separated concept when multidevice get ready
        recoveryCode: this.data.recoveryCode,
        factors: this.data.factors
      }, null, {
        guardianClient: this.guardianClient,
        socket: this.socket,
        hub: this.hub
      });

    return flow;
  }

  /**
   * Ends the transaction cleanup the resources
   */
  end() {
    this.hub.removeAllListeners();
    this.socket.removeAllListeners();
    this.socket.close();
  }
}

module.exports = Transaction;
