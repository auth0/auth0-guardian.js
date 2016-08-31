'use strict';

const errors = require('../errors');
const reduce = require('lodash.reduce');

const strategies = {
  authenticator: require('./strategies/authenticator_enrollment_strategy'),
  pushNotification: require('./strategies/pn_enrollment_strategy'),
  sms: require('./strategies/sms_enrollment_strategy'),
};

const VALID_FACTORS = ['authenticator', 'pushNotification', 'sms'];

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
  canEnrollWithFactor(factor) {
    if (VALID_FACTORS.indexOf(factor) < 0) {
      throw new errors.FactorNotFoundError();
    }

    if (factor === 'authenticator' || factor === 'pushNotification') {
      return this.data.factors.pushNotification.enabled;
    }

    return this.data.factors.sms.enabled;
  }

  /**
   * Returns all available factors
   */
  getAvailableFactors() {
    return reduce(this.data.factors, (available, factor, name) => {
      if (factor.enabled) {
        available.push(name);
      }

      if (name === 'pushNotification') {
        available.push('authenticator');
      }

      return available;
    }, []);
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
