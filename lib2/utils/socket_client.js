'use strict';

var io = require('socket.io-client');
var url = require('./url');
var events = require('./events');
var object = require('./object');
var GuardianError = require('../errors/guardian_error');
var weakMap = require('./naive_weak_map');

var listenersMap = weakMap();

function socketClient(urlBase) {
  var self = object.create(socketClient.prototype);

  var urlObj;
  if (object.isObject(urlBase)) {
    urlObj = url.parse(urlBase);
  }

  var baseUri = {
    host: urlObj.host,
    protocol: urlObj.protocol
  };

  self.socket = io(url.parse(baseUri), {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 50000,
    reconnectionAttempts: 5,
    autoConnect: false
  });

  self.opened = false;

  return self;
}

socketClient.prototype.connect = function connect(token, callback) {
  var self = this;

  var handlers = {
    error: function onError(err) {
      callback(errorBuilder(err));
    },

    unauthorized: function onUnauthorized(err) {
      return callback(new GuardianError({
        message: 'Unauthorized real time connection',
        statusCode: 401,
        errorCode: 'socket_unauthorized',
        cause: err
      }));
    },

    connect: function onConnect() {
      events.onceAny(this.socket, handlers);
      self.socket.emit('authenticate', { token });
    },

    authenticated: function() {
      callback();
    }
  };

  events.onceAny(this.socket, handlers);

  this.socket.once('connect', function onConnect() {
    this.socket.emit('authenticate', { token });
  });
};

socketClient.prototype.addListener = function addListener(kind, event, handler) {
  var wrapped = wrapEventHandler(handler);

  listenersMap.set(handler, wrapped);
  this.socket[kind](event, wrapped);
};

socketClient.prototype.on = function on(event, handler) {
  this.addListener('on', event, handler);
};

socketClient.prototype.once = function once(event, handler) {
  this.addListener('once', event, handler);
};

socketClient.prototype.removeListener = function removeListener(event, handler) {
  var wrapped = listenersMap.get(handler);

  this.socket.removeListener(event, wrapped);
  listenersMap.del(handler);
};

socketClient.prototype.removeAllListeners = function removeAllListeners(eventName) {
  this.socket.removeAllListeners(eventName);
};

function wrapEventHandler(handler) {
  return function wrapper(payload) {
    handler(object.toCamelKeys(payload));
  };
}

function errorBuilder(err) {
  var err = object.toCamelKeys(err);

  return new GuardianError({
    message: err.message === 'string' ? err.message : 'Error on real time connection',
    statusCode: err.statusCode,
    errorCode: err.code || 'socket_error',
    cause: err
  });
}

module.exports = socketClient;
