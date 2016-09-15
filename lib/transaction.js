'use strict';

const errors = require('./errors');
const AuthFlow = require('./auth/auth_flow');
const EnrollmentFlow = require('./enrollment/enrollment_flow');
const enrollment = require('./entities/enrollment');
const object = require('./utils/object');

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
   * @param {object} dependencies.guardianClient
   */
  constructor(data, configuration, dependencies) {
    this.data = data;

    this.dependencies = dependencies;

    this.guardianClient = this.dependencies.guardianClient;

    this.currentEnrollmentFlow = null;
    this.currentAuthFlow = null;
  }

  /**
   * Returns true if there is, at least, one device enrolled.
   *
   * @public
   * @returns {boolean}
   */
  isEnrolled() {
    return enrollment.isEnrollmentConfirmed(this.data.enrollment);
  }

  /**
   * Returns true if user can enroll
   *
   * @public
   * @returns {boolean}
   */
  canEnroll() {
    // Until we support multidevice enrollment is hightly tied to
    // being unenrolled
    return !this.isEnrolled();
  }

  /**
   * Convenience method to start authentication for default factor
   *
   * @public
   * @returns {AuthFlow}
   */
  startAuthForDefaultFactor() {
    return this.startAuth().forDefaultFactor();
  }

  /**
   * Convenience method to start recovery
   *
   * @public
   * @returns {AuthFlow}
   */
  startAuthForRecovery() {
    return this.startAuth().forRecoveryCode();
  }

  /**
   * Starts an authentication flow
   *
   * @private It is private at this point, we might need to make it public
   * to support multidevice
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
      guardianClient: this.guardianClient
    });

    this.currentAuthFlow = flow;

    return flow;
  }

  /**
   * Starts an enrollment flow
   *
   * @public
   * @returns EnrollmentFlow
   * @throws
   *  EnrollNotAllowedError: When you are already enrolled an multidevice
   *    is not supported
   */
  startEnrollment() {
    if (!this.canEnroll()) {
      throw new errors.EnrollmentNotAllowedError();
    }

    return this.getCurrentEnrollmentFlow();
  }

  /**
   * Returns current enrollment flow, creates one if none is found
   *
   * @returns {EnrollmentFlow}
   */
  getCurrentEnrollmentFlow() {
    if (this.currentEnrollmentFlow) {
      return this.currentEnrollmentFlow;
    }

    const flow = new EnrollmentFlow({
      issuer: this.data.issuer,
      transactionToken: this.data.transactionToken,
      enrollmentTxId: this.data.enrollmentTxId,

      enrollment: this.data.enrollment,

        // Recovery code will be a separated concept when multidevice get ready
      recoveryCode: this.data.recoveryCode,
      factors: this.data.factors
    }, null, {
      guardianClient: this.guardianClient
    });

    this.currentEnrollmentFlow = flow;

    return flow;
  }

  /**
   * Marks current transaction as enrolled
   *
   * @param {string} [data.enrollment.name]
   * @param {boolean} [data.enrollment.pushNotifications.enabled]
   * @param {string} [data.enrollment.phoneNumber]
   * @param {string} data.enrollment.status
   */
  markEnrolled(data) {
    object.assign(this.data.enrollment, data.enrollment);

    return this;
  }

  /**
   * Returns current factor or undefined if none
   *
   * @returns {string}
   */
  getCurrentFactor() {
    const strategy = (this.currentEnrollmentFlow || this.currentAuthFlow) &&
      (this.currentEnrollmentFlow || this.currentAuthFlow).getCurrentStrategy();

    return (strategy && strategy.factor) || null;
  }

  /**
   * Returns transaction token
   *
   * @returns {JWTToken}
   */
  getTransactionToken() {
    return this.data.transactionToken;
  }
}

module.exports = Transaction;
