'use strict';

var form = require('./utils/form');
var async = require('./utils/async');
var errors = require('./errors');
var object = require('./utils/object');
var jwtToken = require('./utils/jwt_token');
var enrollment = require('./entities/enrollment');
var transaction = require('./transaction');
var enrollmentAttempt = require('./entities/enrollment_attempt');

/**
 * @param {string} options.serviceBaseUrl Service base url
 * @example `
 *  For US: { protocol: 'https', host: '{tenant-name}.guardian.auth0.com' }
 *  For AU: { protocol: 'https', host: '{tenant-name}.au.guardian.auth0.com' }
 *  For EU: { protocol: 'https', host: '{tenant-name}.eu.guardian.auth0.com' }
 * `
 * @param {string} options.requestToken Request token got from auth0
 * @param {string} options.issuer.label User friendly label for the issuer to
 *  be used on google-authenticator-like apps
 * @param {string} options.issuer.name Unique identifier of the issuer to
 *  be used on google-authenticator-like apps
 *
 * @param {function(serviceBaseUrl)} [dependencies.socketClient] Client factory for socket api
 * @param {function(serviceBaseUrl)} [dependencies.httpClient] Client factory for http
 */
function auth0GuardianJS(options) {
  var self = object.create(auth0GuardianJS.prototype);

  self.serviceBaseUrl = options.serviceBaseUrl;
  self.requestToken = jwtToken(options.requestToken);
  self.issuer = options.issuer;

  self.socketClient = object.get(options, 'dependencies.socketClient', null); // TODO Set default
  self.httpClient = object.get(options, 'dependencies.httpClient', null); // TODO Set default
};

auth0GuardianJS.prototype.start = function(callback) {
  var self = this;

  if (self.requestToken.isExpired()) {
    return async.setImmediate(callback, new errors.TransactionTokenExpiredError());
  }

  self.httpClient.post('/api/start-flow', self.requestToken.token(), function startTransaction(err, txLegacyData) {
    if (err) {
      return callback(err);
    }

    self.socketClient.connect(txLegacyData.transactionToken, function onSocketConnection(err) {
      if (err) {
        return callback(err);
      }

      var tx;
      try {
        tx = buildTransaction(txLegacyData, { transactionEvents: self.socketClient });
      } catch (err) {
        return callback(err);
      }

      return callback(null, tx);
    });
  });
};

/**
 * @param {string} url url to post
 * @param {object} obj result with signature to post
 */
auth0GuardianJS.formPostHelper = function formPostHelper(url, obj) {
  form(global.document).post(url, obj);
};

function getEnabledMethods(txLegacyData) {
  var methods = [];

  if (object.get(txLegacyData, 'featureSwitches.mfaSms.enroll', false)) {
    methods.push('sms');
  }

  if (object.get(txLegacyData, 'featureSwitches.mfaApp.enroll', false)) {
    methods.push('push');
    methods.push('otp');
  }

  return methods;
}

function buildTransaction(txLegacyData, options) {
  var enabledMethods = getEnabledMethods(txLegacyData);

  if (!enabledMethods.length === 0) {
    throw new errors.NoMethodAvailableError();
  }

  var transactionToken = txLegacyData.transactionToken;
  var txData = {};
  txData.transactionToken = jwtToken(transactionToken);

  if (txLegacyData.enrollmentTxId) {
    txData.enrollmentAttempt = enrollmentAttempt({
      enrollmentTxId: txLegacyData.enrollmentTxId,
      otpSecret: txLegacyData.deviceAccount.otpSecret,
      recoveryCode: txLegacyData.deviceAccount.recoveryCode,
      issuer: self.issuer
    });
  } else {
    var enrollmentMethods = txLegacyData.deviceAccount.availableMethods;
    var availableMethods = object.intersec(enrollmentMethods, availableMethods);

    if (availableMethods.length === 0) {
      throw new errors.NoMethodAvailableError();
    }

    var defaultEnrollment = enrollment({
      availableMethods: availableMethods,
      name: txLegacyData.deviceAccount.name,
      phoneNumber: txLegacyData.deviceAccount.phoneNumber
    });

    txData.enrollments = [ defaultEnrollment ];
  }

  return transaction(txData, options);
}

module.exports = auth0GuardianJS;
