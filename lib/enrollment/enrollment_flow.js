'use strict';

const errors = require('../errors');
const factor = require('../entities/factor');
const EventEmitter = require('events').EventEmitter;

const strategies = {
  otp: require('./strategies/otp_enrollment_strategy'),
  push: require('./strategies/pn_enrollment_strategy'),
  sms: require('./strategies/sms_enrollment_strategy'),
};

const VALID_FACTORS = ['otp', 'push', 'sms'];

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
   * @param {otp|push|sms} type
   */
  canEnrollWithFactor(factor) {
    if (VALID_FACTORS.indexOf(factor) < 0) {
      throw new errors.FactorNotFoundError();
    }

    if (factor === 'otp' || factor === 'push') {
      return this.data.factors.push.enabled;
    }

    return this.data.factors.sms.enabled;
  }

  /**
   * Returns all available factors
   */
  getAvailableFactors() {
    return factor.getAvailableFactors(this.data.factors);
  }

  /**
   * @param {otp|push|sms} type
   *
   * @throws EnrollmentNotAllowedError when the enrollment was not allowed
   * @throws DismissedError when enrollment was dismissed
   * @throws FactorNotAllowedError when factor is not allowed
   */
  forFactor(type) {
    if (!this.canEnrollWithFactor(type)) {
      throw new errors.EnrollmentNotAllowedError();
    }

    if (this.dismissed) {
      throw new errors.DismissedError();
    }

    this.currentStrategy = this.getStrategyForFactor(type);

    return this.currentStrategy;
  }

  getCurrentStrategy() {
    return this.currentStrategy;
  }

  getStrategyForFactor(type) {
    const Strategy = strategies[type];

    if (!Strategy) {
      throw new errors.FactorNotAllowedError();
    }

    const strategy = new Strategy({
      issuer: this.data.issuer,
      enrollmentTxId: this.data.enrollmentTxId,
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.dependencies.guardianClient,
      socket: this.socket,
      hub: this.hub
    });

    return strategy;
  }

  transformEnrollmentCompletion(data) {
    return this.getStrategyForFactor(data.factor).transformEnrollmentCompletion(data);
  }

  transformLoginCompletion(data) {
    return this.getCurrentStrategy().transformLoginCompletion(data);
  }
}
