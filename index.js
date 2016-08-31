const EventEmitter = require('events').EventEmitter;
const Transaction = require('./lib/transaction');
const guardianHttpClient = require('/lib/utils/guardian_request');


class GuardianJS {

  /**
   * @param {string} baseUri
   */
  constructor(options) {
    this.events = new EventEmitter();
    this.tenant = this.options.tenant;

    this.guardianClient = guardianHttpClient({ baseUri: options.baseUri });
  }

  /**
   * Starts a Guardian login transaction
   */
  start() {
    return this.guardianClient.post('/start-flow')
      .then((txData) => {

        const tx = new Transaction({
          enrollment: txData.deviceAccount,
          tenant: this.tenant,
          transactionToken: txData.transactionToken,
          recoveryCode: txData.deviceAccount.recoveryCode,
          enrollmentTxId: txData.deviceAccount.enrollmentTxId,
          factors: {
            sms: {
              enabled: txData.featureSwitches.mfa_sms.enroll
            },
            pushNotification: {
              enabled: txData.featureSwitches.mfa_app.enroll
            }
          }
        }, null, {
          guardianClient: this.guardianClient,
        });

        return tx;
      });
  }
}

module.exports = function guardianjs(options) {
  return new GuardianJS(options);
};
