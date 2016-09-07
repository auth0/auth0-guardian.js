'use strict';

const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('./lib/utils/guardian_request');
const errors = require('./lib/errors');
const factorEntity = require('./lib/entities/factor');
const enrollmentEntity = require('./lib/entities/enrollment');
const Promise = require('bluebird');
const JWTToken = require('./lib/utils/jwt_token');

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
    this.requestToken = new JWTToken(options.requestToken);

    this.guardianClient = dependencies.guardianClient || guardianHttpClient({ serviceDomain: options.serviceDomain });
  }

  /**
   * Starts a Guardian login transaction
   */
  start() {
    this.requestToken.once('token-expired', () => this.hub.emit('timeout'));

    return this.guardianClient.post('/start-flow', this.requestToken.getToken())
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

        this.requestToken.removeAllListeners();
        const transactionToken = new JWTToken(txData.transactionToken)
        transactionToken.once('token-expired', () => this.hub.emit('timeout'));

        const data = {
          enrollment: enrollment,
          issuer: this.issuer,
          transactionToken: transactionToken,
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
          hub: this.events
        });

        return tx;
      });
  }
};

