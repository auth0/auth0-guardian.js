const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('/lib/utils/guardian_request');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');

module.exports = class GuardianJS {

  /**
   * @param {string} serviceDomain
   */
  constructor(options) {
    this.events = new EventEmitter();
    this.tenant = this.options.tenant;

    this.guardianClient = guardianHttpClient({ serviceDomain: options.serviceDomain });
  }

  /**
   * Starts a Guardian login transaction
   */
  start() {
    return this.guardianClient.post('/start-flow')
      .then((txData) => {
        const factors = {
          sms: {
            enabled: txData.featureSwitches.mfa_sms.enroll
          },
          push: {
            enabled: txData.featureSwitches.mfa_app.enroll
          }
        };

        const enrollment = txData.deviceAccount;

        if (!factorEntity.isAnyFactorEnabled(factors) &&
            !enrollmentEntity.isEnrollmentConfirmed(enrollment)) {
          return Promise.reject(errors.EnrollmentNotAllowedError());
        }

        const tx = new Transaction({
          enrollment: enrollment,
          tenant: this.tenant,
          transactionToken: txData.transactionToken,
          recoveryCode: txData.deviceAccount.recoveryCode,
          enrollmentTxId: txData.deviceAccount.enrollmentTxId,
          factors: factors
        }, null, {
          guardianClient: this.guardianClient,
        });

        return tx;
      });
  }
};
