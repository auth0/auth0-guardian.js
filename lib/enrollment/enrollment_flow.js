'use strict';

const errors = require('../errors');

const strategies = {
  authenticator: require('./strategies/authenticator_enrollment_strategy'),
  pushNotification: require('./strategies/pn_enrollment_strategy'),
  sms: require('./strategies/sms_enrollment_strategy'),
};

const VALID_TYPES = ['authenticator', 'pushNotification', 'sms'];

module.exports = class EnrollmentFlow {

  constructor(data, configuration, dependencies) {
    this.data = data;
    this.dependencies = dependencies;
  }

  /**
   * Returns the recovery code if available
   */
  getRecoveryCode() {
    return this.data.recoveryCode;
  }

  /**
   * @param {authenticator|pushNotification|sms} type
   */
  canEnrollWithFactor(type) {
    if (VALID_TYPES.indexOf(type) < 0) {
      throw new errors.FactorNotFoundError();
    }

    if (type === 'authenticator' || type === 'pushNotification') {
      return this.data.factors.pushNotification.enabled;
    }

    return this.data.factors.sms.enabled;
  }

  /**
   * @param {authenticator|pushNotification|sms} type
   *
   * @throws EnrollmentNotAllowedError
   */
  forFactor(type) {
    if (!this.canEnrollWithFactor(type)) {
      throw new errors.EnrollmentNotAllowedError();
    }

    const Strategy = strategies[type];

    return new Strategy({
      enrollmentTxId: this.data.enrollmentTxId,
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.dependencies.guardianClient
    });
  }
}
