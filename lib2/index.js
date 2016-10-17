'use strict';

var form = require('./utils/form');
var async = require('./utils/async');
var errors = require('./errors');
var object = require('./utils/object');
var jwtToken = require('./utils/jwt_token');
var enrollment = require('./entities/enrollment');
var httpClient = require('./utils/http_client');
var transaction = require('./transaction');
var socketClient = require('./utils/socket_client');
var enrollmentAttempt = require('./entities/enrollment_attempt');

/**
 * @public
 *
 * @param {string} options.serviceUrl Service base url
 * @example `
 *  For US: https://{name}.guardian.auth0.com
 *  For AU: https://{name}.au.guardian.auth0.com
 *  For EU: https://{name}.eu.guardian.auth0.com
 * `
 * @param {string} options.requestToken Request token got from auth0
 * @param {string} options.issuer.label User friendly label for the issuer to
 *  be used on google-authenticator-like apps
 * @param {string} options.issuer.name Unique identifier of the issuer to
 *  be used on google-authenticator-like apps
 *
 * @param {function(serviceUrl)} [dependencies.socketClient] Client factory for socket api
 * @param {function(serviceUrl)} [dependencies.httpClient] Client factory for http
 */
function auth0GuardianJS(options) {
  var self = object.create(auth0GuardianJS.prototype);

  self.serviceUrl = options.serviceUrl;
  self.requestToken = jwtToken(options.requestToken);
  self.issuer = options.issuer;

  self.socketClient = object.get(options, 'dependencies.socketClient',
    socketClient(self.serviceUrl));
  self.httpClient = object.get(options, 'dependencies.httpClient',
    httpClient(self.serviceUrl));

  return self;
}

/**
 * @public
 *
 * Starts a new transaction
 *
 * @param {function(err, transaction)} callback
 */
auth0GuardianJS.prototype.start = function start(callback) {
  var self = this;

  if (self.requestToken.isExpired()) {
    return async.setImmediate(callback, new errors.TransactionTokenExpiredError());
  }

  return self.httpClient.post('/api/start-flow',
    self.requestToken.getToken(), null, function startTransaction(err, txLegacyData) {
      if (err) {
        return callback(err);
      }

      return self.socketClient.connect(txLegacyData.transactionToken,
        function onSocketConnection(connectErr) {
          if (connectErr) {
            return callback(connectErr);
          }

          var tx;
          try {
            tx = buildTransaction({
              txLegacyData: txLegacyData,
              issuer: self.issuer,
              serviceUrl: self.serviceUrl
            }, {
              transactionEventsReceiver: self.socketClient,
              httpClient: self.httpClient
            });
          } catch (transactionBuildingErr) {
            return callback(transactionBuildingErr);
          }

          return callback(null, tx);
        });
    });
};

/**
 * @public
 *
 * Post result to url using an standard form
 *
 * @param {string} url url to post
 * @param {object} obj result with signature to post
 */
auth0GuardianJS.prototype.formPostHelper = function formPostHelper(url, obj) {
  form({ document: global.document }).post(url, obj);
};

function parseAvailableEnrollmentMethods(txLegacyData) {
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

function parseAvailableAuthMethods(txLegacyData) {
  var methods = [];

  if (object.get(txLegacyData, 'featureSwitches.mfaSms.login', false)) {
    methods.push('sms');
  }

  if (object.get(txLegacyData, 'featureSwitches.mfaApp.login', false)) {
    methods.push('push');
    methods.push('otp');
  }

  return methods;
}

function buildTransaction(data, options) {
  var txLegacyData = data.txLegacyData;
  var issuer = data.issuer;
  var serviceUrl = data.serviceUrl;
  var transactionToken = txLegacyData.transactionToken;
  var availableEnrollmentMethods = parseAvailableEnrollmentMethods(txLegacyData);
  var txData = {};


  txData.transactionToken = jwtToken(transactionToken);
  txData.availableEnrollmentMethods = availableEnrollmentMethods;

  if (txLegacyData.enrollmentTxId) {
    if (availableEnrollmentMethods.length === 0) {
      throw new errors.NoMethodAvailableError();
    }

    txData.enrollmentAttempt = enrollmentAttempt({
      enrollmentId: txLegacyData.deviceAccount.id,
      enrollmentTxId: txLegacyData.enrollmentTxId,
      otpSecret: txLegacyData.deviceAccount.otpSecret,
      recoveryCode: txLegacyData.deviceAccount.recoveryCode,
      issuer: issuer,
      baseUrl: serviceUrl
    });
  } else {
    var availableAuthMethod = ['sms', 'push', 'otp']; // parseAvailableAuthMethods(txLegacyData);
    var availableMethodsForCurrentEnrollment = txLegacyData.deviceAccount.availableMethods;
    var availableMethods = object.intersec(
      availableAuthMethod,
      availableMethodsForCurrentEnrollment
    );

    // if (availableMethods.length === 0) {
    //   throw new errors.NoMethodAvailableError();
    // }

    var defaultEnrollment = enrollment({
      availableMethods: availableMethods,
      name: txLegacyData.deviceAccount.name,
      phoneNumber: txLegacyData.deviceAccount.phoneNumber
    });

    txData.enrollments = [defaultEnrollment];
  }

  return transaction(txData, options);
}

module.exports = auth0GuardianJS;
