'use strict';

const io = require('socket.io-client');
const EventEmitter = require('events').EventEmitter;
const GuardianError = require('../errors/guardian_error');
const object = require('./object');

const serializers = {
  error: [
    {
      socketEvent: 'error',

      transformPayload: function transform(err) {
        const data = err && err.data || {};

        return new GuardianError({
            message: data.message === 'string' ? data.message : 'Error on real time connection',
            statusCode: data.statusCode,
            errorCode: data.code || 'socket_error',
            cause: err,
          });
      },
    },

    {
      socketEvent: 'unauthorized',

      transformPayload: function transform(err) {
        return new GuardianError({
            message: 'Unauthorized real time connection',
            statusCode: 401,
            errorCode: 'socket_unauthorized',
            cause: err,
          });
      },
    },
  ],

  'login-rejected': [
    {
      socketEvent: 'login:rejected',

      transformPayload: function transform(payload) {
        return object.toCamelKeys(payload);
      },
    },
  ],

  'login-complete': [
    {
      socketEvent: 'login:complete',

      transformPayload: function transform(payload) {
        return { loginPayload: object.toCamelKeys(payload) };
      },
    },
  ],

  'enrollment-complete': [
    {
      socketEvent: 'enrollment:confirmed',

      transformPayload: function transform(payload) {
        return {
          enrollment: { name: payload.device_account.name }
        };
      },
    },
  ],
};

class GuardianSocket {
  constructor(options) {
    this.baseUri = options.baseUri;
    this.opened = false;

    this.socket = io(this.baseUri, {
      'reconnection': true,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax' : 50000,
      'reconnectionAttempts': 5,
      'autoConnect': false
    });
  }

  open(token) {
    if (this.opened) {
      return this;
    }

    this.socket.once('connect', () => {
      this.socket.emit('authenticate', { token });
    });

    this.socket.connect();

    this.opened = true;

    return this;
  }

  close() {
    this.socket.disconnect();
  }

  addListener(kind, event, cb) {
    serializers[event].forEach((descriptor) => {
      this.socket[kind](descriptor.socketEvent, (data) => cb(descriptor.transformPayload(data)));
    });

    return this;
  }

  on(event, cb) {
    return this.addListener('on', event, cb);
  }

  once(event, cb) {
    return this.addListener('once', event, cb);
  }

  removeAllListeners() {
    this.socket.removeAllListeners();
  }

  removeListener(event, cb) {
    this.socket.removeListener(event, cb);
  }
}

module.exports = GuardianSocket;
