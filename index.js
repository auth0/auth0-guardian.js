'use strict';

const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('./lib/utils/guardian_request');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');
const Promise = require('bluebird');

module.exports = class GuardianJS {

  /**
   * @param {string} options.serviceDomain
   * @param {string} options.requestToken
   * @param {string} options.tenant.name
   * @param {string} options.tenant.friendlyName
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(options, configuration, dependencies) {
    dependencies = dependencies || {};

    this.events = new EventEmitter();
    this.tenant = options.tenant;
    this.requestToken = options.requestToken;

    this.guardianClient = dependencies.guardianClient || guardianHttpClient({ serviceDomain: options.serviceDomain });
  }

  /**
   * Starts a Guardian login transaction
   */
  start() {
    return this.guardianClient.post('/start-flow', this.requestToken)
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

        this.guardianClient.listenTo('login-complete', this.requestToken, this.events.emit.bind(this.events, 'login-complete'));
        this.guardianClient.listenTo('login-rejected', this.requestToken, this.events.emit.bind(this.events, 'login-rejected'));
        this.guardianClient.listenTo('enrollment-complete', this.requestToken, this.events.emit.bind(this.events, 'enrollment-complete'));
        this.guardianClient.listenTo('error', this.requestToken, this.events.emit.bind(this.events, 'error'));

        const data = {
          enrollment: enrollment,
          tenant: this.tenant,
          transactionToken: txData.transactionToken,
          factors: factors
        };

        if (txData.deviceAccount.recoveryCode) {
          data.recoveryCode = txData.deviceAccount.recoveryCode;
        }

        if (txData.enrollmentTxId) {
          data.enrollmentTxId = txData.enrollmentTxId;
        }

        const tx = new Transaction(data, null, {
          guardianClient: this.guardianClient,
        });

        return tx;
      });
  }
};
