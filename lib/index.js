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
  manual: 'polling'
};

/**
 * @public
 *
 * @param {string} options.serviceUrl Service base url
 * @example `
 *  For US: https://{name}.guardian.auth0.com
 *  For AU: https://{name}.guardian.au.auth0.com
 *  For EU: https://{name}.guardian.eu.auth0.com
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
 * @param {string} [options.stateCheckingMechanism] Transport: 'polling' (default) or 'manual'
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

  self.transport = options.transport || options.stateCheckingMechanism || apiTransport.polling;

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

      var transactionToken;
      try {
        transactionToken = jwtToken(txLegacyData.transactionToken);
      } catch (e) {
        callback(e);
        return;
      }

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

 * @param {string} [options.stateCheckingMechanism] Transport: 'polling' (default) or 'manual'
 * @param {function(serviceUrl)} [options.dependencies.httpClient] Client factory for http
 */

auth0GuardianJS.resume = function resume(options, transactionState, callback) {
  try {
    var transactionTokenObject;
    transactionTokenObject = jwtToken(transactionState.transactionToken);

    var txId = transactionTokenObject.getDecoded().txid;

    // create httpClient/socketClient
    var httpClientInstance = object.get(options, 'dependencies.httpClient',
      httpClient(transactionState.baseUrl, txId));

    var transport = options.transport || options.stateCheckingMechanism || apiTransport.polling;

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
  } catch (err) {
    if (err.name === 'InvalidTokenError') {
      asyncHelpers.setImmediate(callback, new errors.InvalidToken('Invalid transaction token'));
      return;
    }

    asyncHelpers.setImmediate(callback, err);
  }
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
