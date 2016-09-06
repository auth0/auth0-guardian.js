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
  }

  open(token) {
    if (this.socket) {
      return this;
    }

    this.socket = io(this.baseUri, {
      'reconnection': true,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax' : 50000,
      'reconnectionAttempts': 5,
      'autoConnect': false
    });

    this.socket.once('connect', () => {
      this.socket.emit('authenticate', { token });
    });

    this.socket.connect();

    return this;
  }

  listenTo(event, cb) {
    serializers[event].forEach((descriptor) => {
      this.socket.on(descriptor.socketEvent, (data) => cb(descriptor.transformPayload(data)));
    });

    return this;
  }
}

module.exports = GuardianSocket;
