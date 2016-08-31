'use strict';

const ALLOWED_TYPES = ['authenticator', 'pushNotification', 'sms'];

const ManualAuthenticatorStrategy = require('./strategies/manual_authenticator_strategy');
const PushAuthenticatorStrategy = require('./strategies/pn_authenticator_strategy');
const SMSAuthenticatprStrategy = require('./strategies/sms_authenticator_strategy');
const RecoveryCodeAuthenticatorStrategy = require('./strategies/recovery_code_authenticator_strategy');

const FACTOR_MODE_STRATEGIES = {
  authenticator: {
    default: ManualAuthenticatorStrategy
  },
  pushNotification: {
    default: PushAuthenticatorStrategy,
    manual: ManualAuthenticatorStrategy
  },
  sms: {
    default: SMSAuthenticatprStrategy
  },
  recoveryCode: {
    default: RecoveryCodeAuthenticatorStrategy
  }
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
      return 'pushNotification';
    } else {
      return 'authenticator';
    }
  }

  /**
   * @param {authenticator|sms|pushNotification|recoveryCode} factor
   * @param {boolean} manual
   */
  forFactor(factor, manual) {
    const Strategy = FACTOR_MODE_STRATEGIES[factor][manual ? 'manual' : 'default'];

    const strategy = new Strategy({
      transactionToken: this.data.transactionToken,
      enrollment: this.data.enrollment
    }, null, {
      guardianClient: this.guardianClient
    });

    return strategy;
  }
};
