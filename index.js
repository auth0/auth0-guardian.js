'use strict';

const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('./lib/utils/guardian_request');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');
const Promise = require('bluebird');

global.GuardianJS = module.exports = class GuardianJS {

  /**
   * @param {string} options.serviceDomain
   * @param {string} options.requestToken
   * @param {string} options.issuer.label
   * @param {string} options.issuer.name
   *
   * @param {GuardianClient} dependencies.guardianClient
   */
  constructor(options, configuration, dependencies) {
    dependencies = dependencies || {};

    this.events = new EventEmitter();
    this.issuer = options.issuer;
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

        this.guardianClient.listenTo('login-complete', txData.transactionToken, this.events.emit.bind(this.events, 'login-complete'));
        this.guardianClient.listenTo('login-rejected', txData.transactionToken, this.events.emit.bind(this.events, 'login-rejected'));
        this.guardianClient.listenTo('enrollment-complete', txData.transactionToken, this.events.emit.bind(this.events, 'enrollment-complete'));
        this.guardianClient.listenTo('error', txData.transactionToken, this.events.emit.bind(this.events, 'error'));

        const data = {
          enrollment: enrollment,
          issuer: this.issuer,
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

