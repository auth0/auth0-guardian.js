'use strict';

const ALLOWED_TYPES = ['otp', 'push', 'sms'];

const OTPAuthenticatorStrategy = require('./strategies/otp_authenticator_strategy');
const PushAuthenticatorStrategy = require('./strategies/pn_authenticator_strategy');
const SMSAuthenticatprStrategy = require('./strategies/sms_authenticator_strategy');
const RecoveryCodeAuthenticatorStrategy = require('./strategies/recovery_code_authenticator_strategy');
const errors = require('../errors');

const FACTOR_MODE_STRATEGIES = {
  otp: OTPAuthenticatorStrategy,
  sms: SMSAuthenticatprStrategy,
  push: PushAuthenticatorStrategy
};

module.exports = class AuthFlow {

  constructor(data, configuration, dependencies) {
    this.data = data;

    this.guardianClient = dependencies.guardianClient;
  }

  /**
   * Note: it is called this way to prepare future
   * multidevice changes
   */
  getDefaultFactor() {
    if (this.data.enrollment.phoneNumber) {
      return 'sms';
    } else if (this.data.enrollment.pushNotifications &&
      this.data.enrollment.pushNotifications.enabled) {
      return 'push';
    } else {
      return 'otp';
    }
  }

  /**
   * Returns an authenticator flow for the recovery code
   *
   * @public
   */
  forRecoveryCode() {
    this.currentStrategy = new RecoveryCodeAuthenticatorStrategy({
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.guardianClient
    });

    return this.currentStrategy;
  }

  /**
   * Returns an auth flow for the default factor
   *
   * @public
   */
  forDefaultFactor() {
    return this.forFactor(this.getDefaultFactor());
  }

  /**
   * Returns an auth flow for the given factor
   *
   * @private It might be made public when multidevice gets ready
   * @param {otp|sms|push} factor
   * @throws FactorNotFoundError when factor is invalid
   */
  forFactor(factor) {
    const Strategy = FACTOR_MODE_STRATEGIES[factor];

    if (!Strategy) {
      throw new errors.FactorNotFoundError();
    }

    this.currentStrategy = new Strategy({
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.guardianClient
    });

    return this.currentStrategy;
  }

  getCurrentStrategy() {
    return this.currentStrategy;
  }
};
