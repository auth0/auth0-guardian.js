'use strict';

var form = require('./utils/form');
var asyncHelpers = require('./utils/async');
var errors = require('./errors');
var object = require('./utils/object');
var jwtToken = require('./utils/jwt_token');
var auth0Ticket = require('./utils/auth0_ticket');
var httpClient = require('./utils/http_client');
var transactionFactory = require('./transaction/factory');
var clientFactory = require('./utils/client_factory');

var apiTransport = {
  polling: 'polling',
  manual: 'polling',
  socket: 'socket'
};

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
 *
 * @deprecated @param {string} [options.transport] Use stateCheckingMechanism
 * @param {string} [options.stateCheckingMechanism]
 *
 * @param {SocketClient} [options.dependencies.socketClient] Client factory for socket api
 * @param {function(serviceUrl)} [options.dependencies.httpClient] Client factory for http
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

  self.transport = options.transport || options.state_checking_mechanism || 'socket';

  self.socketClient = clientFactory.create({
    serviceUrl: self.serviceUrl,
    transport: self.transport,
    httpClient: self.httpClient,
    dependency: object.get(options, 'dependencies.socketClient')
  });

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
    // TODO: polling is not a good name for api state checking since
    // it could be polling or manual checking
    { state_transport: apiTransport[self.transport] },
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
            tx = transactionFactory.fromStartFlow({
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
 * Takes a parameter returned from transaction.serialize to resume the transaction
 * with auth0-mfa-api
 *
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
 * @param {string} transactionState.baseUrl

 * @deprecated @param {string} [options.transport] Use stateCheckingMechanism
 * @param {string} [options.stateCheckingMechanism]
 *
 * @param {SocketClient} [options.dependencies.socketClient] Client factory for socket api
 * @param {function(serviceUrl)} [options.dependencies.httpClient] Client factory for http
 */

auth0GuardianJS.resume = function resume(options, transactionState, callback) {
  var transactionTokenObject = jwtToken(transactionState.transactionToken);
  var txId = transactionTokenObject.getDecoded().txid;

  // create httpClient/socketClient
  var httpClientInstance = object.get(options, 'dependencies.httpClient',
    httpClient(transactionState.baseUrl, txId));

  var transport = options.transport || options.stateCheckingMechanism || 'socket';

  if (transactionTokenObject.isExpired()) {
    asyncHelpers.setImmediate(callback, new errors.CredentialsExpiredError());
    return;
  }

  var socketClient = clientFactory.create({
    serviceUrl: transactionState.baseUrl,
    transport: transport,
    httpClient: httpClientInstance,
    dependency: object.get(options, 'dependencies.socketClient')
  });

  // connect
  socketClient.connect(transactionState.transactionToken,
    function onSocketConnection(connectErr) {
      if (connectErr) {
        callback(connectErr);
        return;
      }
      var tx;

      try {
        tx = transactionFactory.fromTransactionState(transactionState, {
          transactionEventsReceiver: socketClient,
          httpClient: httpClientInstance
        });
      } catch (transactionBuildingErr) {
        callback(transactionBuildingErr);
        return;
      }

      callback(null, tx);
    });
};


/**
 * @public
 *
 * Post result to url using a standard form
 *
 * @param {string} url url to post
 * @param {object} obj result with signature to post
 */
auth0GuardianJS.formPostHelper = function formPostHelper(url, obj) {
  form({ document: global.document }).post(url, obj);
};


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
