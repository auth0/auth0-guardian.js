'use strict';

const errors = require('./errors');
const AuthFlow = require('./auth/auth_flow');
const EnrollmentFlow = require('./enrollment/enrollment_flow');
const some = require('lodash.some');
const enrollment = require('./entities/enrollment');
const factor = require('./entities/factor');

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
   * @param {object} configuration
   *
   * @param {object} depedencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.dependencies = dependencies;
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
   * Starts an authentication flow
   *
   * @returns AuthenticatorFlow
   */
  startAuth() {
    if (!this.isEnrolled()) {
      throw new errors.NotEnrolledError();
    }

    const flow = new AuthFlow({
        transactionToken: this.data.transactionToken,
        enrollment: this.data.enrollment,
        factors: this.data.factors
      }, null, {
        guardianClient: this.dependencies.guardianClient
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

    const flow = new EnrollmentFlow({
        transactionToken: this.data.transactionToken,
        enrollmentTxId: this.data.enrollmentTxId,

        enrollment: this.data.enrollment,

        // Recovery code will be a separated concept when multidevice get ready
        recoveryCode: this.data.recoveryCode,
        factors: this.data.factors
      }, null, {
        guardianClient: this.dependencies.guardianClient
      });

    return flow;
  }
}

module.exports = Transaction;
