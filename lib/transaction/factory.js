var enrollmentAttempt = require('../entities/enrollment_attempt');
var enrollment = require('../entities/enrollment');
var transaction = require('./');
var jwtToken = require('../utils/jwt_token');
var object = require('../utils/object');

exports.fromStartFlow = function buildTransactionFromStartFlow(data, options) {
  var txLegacyData = data.txLegacyData;
  var issuer = data.issuer;
  var serviceUrl = data.serviceUrl;
  var accountLabel = data.accountLabel;
  var transactionToken = data.transactionToken;
  var txData = {};

  txData.transactionToken = transactionToken;
  txData.availableEnrollmentMethods = txLegacyData.availableEnrollmentMethods;
  txData.availableAuthenticationMethods = txLegacyData.availableAuthenticationMethods;

  if (txLegacyData.enrollmentTxId) {
    txData.enrollmentAttempt = enrollmentAttempt({
      enrollmentId: txLegacyData.deviceAccount.id,
      enrollmentTxId: txLegacyData.enrollmentTxId,
      otpSecret: txLegacyData.deviceAccount.otpSecret,
      recoveryCode: txLegacyData.deviceAccount.recoveryCode,
      issuer: issuer,
      baseUrl: serviceUrl,
      accountLabel: accountLabel
    });
  } else {
    var defaultEnrollment = enrollment({
      methods: txLegacyData.deviceAccount.methods,
      availableMethods: txLegacyData.deviceAccount.availableMethods,
      name: txLegacyData.deviceAccount.name,
      phoneNumber: txLegacyData.deviceAccount.phoneNumber
    });

    txData.enrollments = [defaultEnrollment];
  }

  return transaction(txData, options);
};
/**
 * @param {string} transactionState.transactionToken
 *
 * @param {undefined|Object} transactionState.enrollmentAttempt
 * @param {Object} transactionState.enrollmentAttempt.data - @see enrollmentAttempt
 * @param {boolean} transactionState.enrollmentAttempt.active
 *
 * @param {object[]} transactionState.enrollments - @see enrollment

 * @param {object} transactionState.availableEnrollmentMethods
 * @param {object} transactionState.availableAuthenticationMethods
 *
 * @param {EventEmitter} options.transactionEventsReceiver
 *  Receiver for transaction events; it will receive  backend related transaction events
 * @param {HttpClient} options.HttpClient
 *
 * @returns {Transaction}
 */
exports.fromTransactionState = function fromTransactionState(transactionState, options) {
  var txData = {
    transactionToken: jwtToken(transactionState.transactionToken),
    enrollments: object.map(transactionState.enrollments, enrollment),
    availableEnrollmentMethods: transactionState.availableEnrollmentMethods,
    availableAuthenticationMethods: transactionState.availableAuthenticationMethods
  };

  if (transactionState.enrollmentAttempt) {
    txData.enrollmentAttempt = enrollmentAttempt(
      transactionState.enrollmentAttempt.data,
      transactionState.enrollmentAttempt.active
    );
  }

  return transaction(txData, options);
};
