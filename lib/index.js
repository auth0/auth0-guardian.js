'use strict';

var form = require('./utils/form');
var asyncHelpers = require('./utils/async');
var errors = require('./errors');
var object = require('./utils/object');
var jwtToken = require('./utils/jwt_token');
var auth0Ticket = require('./utils/auth0_ticket');
var enrollment = require('./entities/enrollment');
var httpClient = require('./utils/http_client');
var transaction = require('./transaction');
var socketClient = require('./utils/socket_client');
var pollingClient = require('./utils/polling_client');
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
 * @param {string} [options.globalTrackingId] Id used to associate the request
 * in the transaction (that includes both Guardian and Auth0-server requests)
 * @param {string} options.accountLabel
 * @param {socket|polling} [options.transport]
 *
 * @param {SocketClient} [dependencies.socketClient] Client factory for socket api
 * @param {function(serviceUrl)} [dependencies.httpClient] Client factory for http
 */
function auth0GuardianJS(options) {
  var self = object.create(auth0GuardianJS.prototype);

  self.serviceUrl = options.serviceUrl;
  self.credentials = authFactory(options);
  self.issuer = options.issuer;
  self.accountLabel = options.accountLabel;

  var globalTrackingId = options.globalTrackingId;

  self.httpClient = object.get(options, 'dependencies.httpClient',
    httpClient(self.serviceUrl, globalTrackingId));

  self.socketClient = object.get(options, 'dependencies.socketClient');
  self.transport = options.transport || 'socket';

  if (!self.socketClient) {
    if (options.transport === 'polling') {
      self.socketClient = pollingClient(self.serviceUrl, { httpClient: self.httpClient });
    } else {
      self.socketClient = socketClient(self.serviceUrl);
    }
  }

  return self;
}

function authFactory(options) {
  if (options.ticket) {
    return auth0Ticket(options.ticket);
  }

  return jwtToken(options.requestToken);
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

  if (self.credentials.isExpired()) {
    asyncHelpers.setImmediate(callback, new errors.CredentialsExpiredError());
    return;
  }

  self.httpClient.post('/api/start-flow',
    self.credentials,
    { state_transport: self.transport },
    function startTransaction(err, txLegacyData) {
      if (err) {
        callback(err);
        return;
      }

      var transactionToken = jwtToken(txLegacyData.transactionToken);

      self.socketClient.connect(transactionToken,
        function onSocketConnection(connectErr) {
          if (connectErr) {
            callback(connectErr);
            return;
          }

          var tx;
          try {
            tx = buildTransaction({
              transactionToken: transactionToken,
              txLegacyData: txLegacyData,
              issuer: self.issuer,
              serviceUrl: self.serviceUrl,
              accountLabel: self.accountLabel
            }, {
              transactionEventsReceiver: self.socketClient,
              httpClient: self.httpClient
            });
          } catch (transactionBuildingErr) {
            callback(transactionBuildingErr);
            return;
          }

          callback(null, tx);
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
auth0GuardianJS.formPostHelper = function formPostHelper(url, obj) {
  form({ document: global.document }).post(url, obj);
};

function buildTransaction(data, options) {
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
}

module.exports = auth0GuardianJS;

/**
 * Interface for classes that represent a way to get the transaction state
 *
 * @interface SocketClient
 */

/**
 * Starts a connection to the server to get the transaction state
 *
 * @function
 * @name SocketClient#connect
 *
 * @param {JWTToken} token transaction token
 * @param {function(err)} callback callback for when connection is stablished
 */

/**
 * Adds a listener for transaction events
 *
 * @function
 * @name SocketClient#on
 *
 * @param {string} event event name
 * @param {function(payload)} handler event handler
 */

/**
 * Adds a listener for transaction events that is removed after event is
 * fired one time
 *
 * @function
 * @name SocketClient#once
 *
 * @param {string} event event name
 * @param {function(payload)} handler event handler
 */

/**
 * Removes a particular event listener
 *
 * @function
 * @name SocketClient#removeListener
 *
 * @param {string} event event name
 * @param {function(payload)} handler event handler
 */

/**
 * Removes all event listener for the particular event, if the event is not
 * provided all event listeners will be removed
 *
 * @function
 * @name SocketClient#removeAllListeners
 *
 * @param {string} [event] event name
 */
