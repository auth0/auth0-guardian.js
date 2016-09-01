'use strict';

const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('./lib/utils/guardian_request');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');

module.exports = class GuardianJS {

  /**
   * @param {string} options.serviceDomain
   * @param {string} options.tenant.name
   * @param {string} options.tenant.friendlyName
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(options, configuration, dependencies) {
    dependencies = dependencies || {};

    this.events = new EventEmitter();
    this.tenant = options.tenant;

    this.guardianClient = dependencies.guardianClient || guardianHttpClient({ serviceDomain: options.serviceDomain });
  }

  /**
   * Starts a Guardian login transaction
   */
  start() {
    return this.guardianClient.post('/start-flow')
      .then((txData) => {
        const factors = {
          sms: {
            enabled: txData.featureSwitches.mfaSms.enroll
          },
          push: {
            enabled: txData.featureSwitches.mfaApp.enroll
          }
        };

        const enrollment = txData.deviceAccount;

        if (!factorEntity.isAnyFactorEnabled(factors) &&
            !enrollmentEntity.isEnrollmentConfirmed(enrollment)) {
          return Promise.reject(new errors.EnrollmentNotAllowedError());
        }

        const tx = new Transaction({
          enrollment: enrollment,
          tenant: this.tenant,
          transactionToken: txData.transactionToken,
          recoveryCode: txData.deviceAccount.recoveryCode,
          enrollmentTxId: txData.enrollmentTxId,
          factors: factors
        }, null, {
          guardianClient: this.guardianClient,
        });

        return tx;
      });
  }
};
