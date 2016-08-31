'use strict';

const request = require('./request');
const urlJoin = require('url-join');
const forEach = require('lodash.forEach');
const object = require('./lib/utils/object');
const GuardianError = require('../guardian_error');
const EventEmitter = require('events').EventEmitter;


const socketEventsTransform = {
  error: [
    {
      socketEvent: 'error',

      transformPayload: function transform(err) {
        return new GuardianError({
            message: err.message,
            statusCode: 400,
            errorCode: 'socket_error',
            cause: err,
          });
      },
    },

    {
      socketEvent: 'unauthorized',

      transformPayload: function transform(err) {
        return new GuardianError({
            message: err.message,
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
        return payload;
      },
    },
  ],

  'login-complete': [
    {
      socketEvent: 'login:complete',

      transformPayload: function transform(payload) {
        return payload;
      },
    },
  ],

  'enrollment-complete': [
    {
      socketEvent: 'enrollment:confirmed',

      transformPayload: function transform(payload) {
        return payload;
      },
    },
  ],
};

/**
 * @param {string} options.baseUri
 */
module.exports = function(options) {
  return new GuardianRequest(options);
};

class GuardianRequest {
  constructor(options, dependencies) {
    this.baseUri = `https://${options.serviceDomain}`;

    this.socket;
  }

  request(method, path, token, data) {
    return request[method](urlJoin(this.baseUri, path), token, data && object.toSnakeKeys(data))
      .then(object.toCamelKeys.bind(object))
      .catch((err) => {
        if (err && err.body) {
          const body = object.toCamelKeys(err.body);

          return new GuardianError({
            message: body.message,
            statusCode: body.statusCode,
            errorCode: body.errorCode,
            cause: err
          });
        }

        return new GuardianError({ message: 'Guardian request error', cause: err });
      });
  }

  get(path, token) {
    return this.request('get', path, token);
  }

  post(path, token, data) {
    return this.request('post', path, token, data);
  }

  put(path, token, data) {
    return this.request('put', path, token, data);
  }

  patch(path, token, data) {
    return this.request('patch', path, token, data);
  }

  del(path, token, data) {
    return this.request('del', path, token, data);
  }

  listenTo(event, token, cb) {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
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
    }

    socketEventsTransform[event].forEach((descriptor) => {
      this.socket.on(descriptor.socketEvent, (data) => cb(descriptor.transformPayload(data)));
    });
  }

  getBaseUri() {
    return this.baseUri;
  }
}
