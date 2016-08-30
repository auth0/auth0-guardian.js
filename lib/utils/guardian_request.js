'use strict';

const request = require('./request');
const urlJoin = require('url-join');
const object = require('./lib/utils/object');
const GuardianError = require('../guardian_error');

/**
 * @param {string} options.baseUri
 */
module.exports = function(options) {
  return new GuardianRequest(options);
};

class GuardianRequest {
  constructor(options) {
    this.baseUri = options.baseUri;
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
}
