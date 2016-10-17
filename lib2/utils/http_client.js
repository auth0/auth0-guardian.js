'use strict';

var agent = require('superagent');
var url = require('./url');
var object = require('./object');
var errors = require('../errors');

/**
 * HTTP Client library
 *
 * @param {object|string} base url or url object to be format with url.format
 */
function httpClient(baseUrl) {
  var self = object.create(httpClient.prototype);

  if (object.isString(baseUrl)) {
    self.baseUrl = url.format(baseUrl);
  } else {
    self.baseUrl = baseUrl;
  }

  return self;
}

httpClient.prototype.get = function get(path, token, callback) {
  return this.request('get', path, token, null, callback);
};

httpClient.prototype.put = function put(path, token, data, callback) {
  return this.request('put', path, token, data, callback);
};

httpClient.prototype.post = function post(path, token, data, callback) {
  return this.request('post', path, token, data, callback);
};

httpClient.prototype.del = function del(path, token, data, callback) {
  return this.request('delete', path, token, data, callback);
};

httpClient.prototype.patch = function patch(path, token, data, callback) {
  return this.request('patch', path, token, data, callback);
};

httpClient.prototype.request = function request(method, path, token, data, callback) {
  return agent[method](url.join(this.baseUrl, path))
    .set('Authorization', 'Bearer ' + token)
    .set('Accept', 'application/json')
    .send(data)
    .end(function onHttpResponse(err, response) {
      if (err) {
        return callback(buildError(err.response, err));
      }

      if (!response.ok) {
        return callback(buildError(response, null));
      }

      return callback(null, object.toCamelKeys(response.body));
    });
};

function buildError(response, err) {
  response = response || {}; // eslint-disable-line no-param-reassign
  var body = object.toCamelKeys(response.body);

  return new errors.GuardianError({
    message: body.message,
    statusCode: response.statusCode || body.statusCode,
    errorCode: body.errorCode,
    cause: err
  });
}

module.exports = httpClient;
