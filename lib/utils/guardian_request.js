'use strict';

const request = require('./request');
const urlJoin = require('url-join');
const object = require('./object');
const GuardianError = require('../errors/guardian_error');
const GuardianSocket = require('./guardian_socket');
const Promise = require('bluebird');

/**
 * @param {string} options.baseUri
 */
module.exports = function(options) {
  return new GuardianRequest(options);
};

class GuardianRequest {
  constructor(options, dependencies) {
    this.baseUri = `https://${options.serviceDomain}`;
  }

  request(method, path, token, data) {
    return request[method](urlJoin(this.baseUri, '/api', path), token, data && object.toSnakeKeys(data))
      .then(result => object.toCamelKeys(result.body))
      .catch((err) => {
        if (err && err.response) {
          const body = object.toCamelKeys(err.response.body);

          return Promise.reject(new GuardianError({
            message: body.message,
            statusCode: err.response.statusCode || body.statusCode,
            errorCode: body.errorCode,
            cause: err
          }));
        }

        return Promise.reject(new GuardianError({ message: 'Guardian request error', cause: err }));
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

  socket() {
    return new GuardianSocket({ baseUri: this.baseUri });
  }

  getBaseUri() {
    return this.baseUri;
  }
}
