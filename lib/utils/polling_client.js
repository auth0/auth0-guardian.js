'use strict';

var url = require('./url');
var object = require('./object');
var EventEmitter = require('events').EventEmitter;
var httpClient = require('./http_client');

var DEFAULT_POLLING_INTERVAL_MS = 5000;
var MIN_POLLING_INTERVAL_MS = 2000;
var DEFAULT_TIME_SHIFT_TOLERANCE_FACTOR = 0.2;

/**
 * @implements SocketClient
 * @param {HttpClient} options.httpClient
 */
function pollingClient(urlBase, options) {
  options = options || {}; // eslint-disable-line no-param-reassign

  var self = object.create(pollingClient.prototype);

  self.httpClient = options.httpClient || httpClient(urlBase);

  if (object.isObject(urlBase)) {
    urlBase = url.format(urlBase); // eslint-disable-line no-param-reassign
  }

  self.hub = new EventEmitter();

  self.state = null;
  self.limits = {
    limit: null,
    remaining: null,
    reset: null
  };

  self.defaultPollingIntervalMs = options.pollingIntervalMs || DEFAULT_POLLING_INTERVAL_MS;
  self.minPollingIntervalMs = options.minPollingIntervalMs || MIN_POLLING_INTERVAL_MS;

  return self;
}

pollingClient.prototype.pollStateOnce = function pollStateOnce(token, callback) {
  var self = this;

  self.httpClient.post('/api/transaction-state', token, null, { completeResponse: true },
     function onResponse(err, response) {
       if (err) {
         if (callback) {
           callback(err);
         } else {
           self.handleErrors(err);
         }

         return;
       }

       self.limits = self.getLimits(response);

       self.emitEvents(null, self.state, response.body);

       self.state = response.body;

       if (callback) {
         callback(null, response.body);
       }
     });
};

/**
 * @private
 */
pollingClient.prototype.getLimits = function getLimits(response) {
  return {
    limit: response.headers['X-RateLimit-Limit'],
    remaining: response.headers['X-RateLimit-Remaining'],
    reset: response.headers['X-RateLimit-Reset']
  };
};

/**
 * @private
 */
pollingClient.prototype.handleErrors = function handleErrors(err) {
  if (err.response && err.response.statusCode === 429) {
    this.handleRateLimit(err);
  } else {
    this.emitEvents(err);
  }
};

/**
 * @private
 */
pollingClient.prototype.handleRateLimit = function handleRateLimit(err) {
  var self = this;

  self.closeConnection();
  self.limits = self.getLimits(err.response);

  self.intervalPoll();
};

/**
 * @private
 */
pollingClient.prototype.calcPollingInterval = function calcPollingInterval() {
  var self = this;
  var interval;

  if (self.limits.reset && self.limits.remaining !== null &&
    typeof self.limits.remaining !== 'undefined') {
    var remainingMsToReset = ((this.limits.reset * 1000) - Date.now());

    interval = this.limits.remaining === 0
      ? remainingMsToReset
      : remainingMsToReset / this.limits.remaining;

    interval = Math.ceil(interval * (1 + DEFAULT_TIME_SHIFT_TOLERANCE_FACTOR));
  }

  if (!interval || interval < 0) {
    interval = self.defaultPollingIntervalMs;
  }

  if (interval < self.minPollingIntervalMs) {
    interval = self.minPollingIntervalMs;
  }

  return interval;
};

/**
 * @private
 */
pollingClient.prototype.startIntervalPolling = function startIntervalPolling() {
  var self = this;

  if (self.timeoutId) {
    return;
  }

  self.pollStateOnce(self.token, function onPoll(err) {
    if (err) {
      self.handleErrors(err);
      return;
    }

    self.intervalPoll();
  });
};

/**
 * @private
 */
pollingClient.prototype.intervalPoll = function intervalPoll() {
  var self = this;

  clearTimeout(self.timeoutId);

  var interval = self.calcPollingInterval();

  // We are not using interval so we consider that the interval / tokens
  // etc could have changed
  self.timeoutId = setTimeout(function onPoll() {
    self.pollStateOnce(self.token);

    if (!self.timeoutId) {
      return;
    }

    self.intervalPoll(self.token);
  }, interval);
};

/**
 * @private
 */
pollingClient.prototype.emitEvents = function emitEvents(err, oldState, newState) {
  var self = this;

  if (err) {
    self.hub.emit('error', err);
    self.closeConnection();
    return;
  }

  if (oldState && oldState.state === 'pending' &&
  !oldState.enrollment && newState.enrollment) {
    self.hub.emit('enrollment:confirmed', object.toCamelKeys({
      device_account: newState.enrollment,
      tx_id: newState.id
    }));
  }

  if (newState.state === 'accepted') {
    self.hub.emit('login:complete', object.toCamelKeys({
      tx_id: newState.id,
      signature: newState.token
    }));

    self.closeConnection();
  }

  if (newState.state === 'rejected') {
    self.hub.emit('login:rejected', object.toCamelKeys({ tx_id: newState.id }));
  }
};

/**
 * Closes current connection
 *
 * @private
 */
pollingClient.prototype.closeConnection = function closeConnection() {
  clearTimeout(this.timeoutId);
  delete this.timeoutId;
};

/**
 * Closes current connection
 *
 * @private
 */
pollingClient.prototype.isConnected = function isConnected() {
  return this.timeoutId !== undefined;
};

/**
 * @public
 */
pollingClient.prototype.connect = function connect(token, callback) {
  this.token = token;
  this.startIntervalPolling(token);
  callback();
};

/**
 * @public
 */
pollingClient.prototype.on = function on(event, handler) {
  this.hub.on(event, handler);
};

/**
 * @public
 */
pollingClient.prototype.once = function once(event, handler) {
  this.hub.once(event, handler);
};

/**
 * @public
 */
pollingClient.prototype.removeListener = function removeListener(event, handler) {
  this.hub.removeListener(event, handler);
};

/**
 * @public
 */
pollingClient.prototype.removeAllListeners = function removeAllListeners(eventName) {
  this.hub.removeAllListeners(eventName);
};

module.exports = pollingClient;
