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

  if (object.isObject(urlBase)) {
    urlBase = url.format(urlBase); // eslint-disable-line no-param-reassign
  }

  self.socket = io(urlBase, {
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
      callback(new GuardianError({
        message: 'Unauthorized real time connection',
        statusCode: 401,
        errorCode: 'socket_unauthorized',
        cause: err
      }));
      return;
    },

    connect: function onConnect() {
      events.onceAny(self.socket, handlers);
      self.socket.emit('authenticate', { token: token.getToken() });
    },

    authenticated: function authenticated() {
      callback();
    }
  };

  events.onceAny(this.socket, handlers);

  // this.socket.once('connect', function onConnect() {
  //   this.socket.emit('authenticate', { token: token });
  // });

  this.socket.connect();
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
  var cErr = object.toCamelKeys(err);

  return new GuardianError({
    message: cErr.message === 'string' ? cErr.message : 'Error on real time connection',
    statusCode: cErr.statusCode,
    errorCode: cErr.code || 'socket_error',
    cause: err
  });
}

module.exports = socketClient;
