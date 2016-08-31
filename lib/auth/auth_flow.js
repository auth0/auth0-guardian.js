'use strict';

const ALLOWED_TYPES = ['otp', 'push', 'sms'];

const OTPAuthenticatorStrategy = require('./strategies/otp_authenticator_strategy');
const PushAuthenticatorStrategy = require('./strategies/pn_authenticator_strategy');
const SMSAuthenticatprStrategy = require('./strategies/sms_authenticator_strategy');
const RecoveryCodeAuthenticatorStrategy = require('./strategies/recovery_code_authenticator_strategy');

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

  // Note: it is called this way to prepare future
  // multidevice changes
  getDefaultFactor() {
    if (this.data.enrollment.phoneNumber) {
      return 'sms';
    } else if (this.data.enrollment.pushCredentials) {
      return 'push';
    } else {
      return 'otp';
    }
  }

  /**
   * Returns an authenticator flow for the recovery code
   */
  forRecoveryCode() {
    return new RecoveryCodeAuthenticatorStrategy({
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.guardianClient
    });
  }

  /**
   * Returns an auth flow for the default factor
   */
  forDefaultFactor() {
    return this.forFactor(this.getDefaultFactor());
  }

  /**
   * Returns an auth flow for the given factor
   *
   * @param {otp|sms|push} factor
   */
  forFactor(factor) {
    const Strategy = FACTOR_MODE_STRATEGIES[factor];

    const strategy = new Strategy({
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.guardianClient
    });

    return strategy;
  }
};
