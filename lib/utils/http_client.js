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

httpClient.prototype.get = function get(path, credentials, callback) {
  this.request('get', path, credentials, null, callback);
};

httpClient.prototype.put = function put(path, credentials, data, callback) {
  this.request('put', path, credentials, data, callback);
};

httpClient.prototype.post = function post(path, credentials, data, callback) {
  this.request('post', path, credentials, data, callback);
};

httpClient.prototype.del = function del(path, credentials, data, callback) {
  this.request('delete', path, credentials, data, callback);
};

httpClient.prototype.patch = function patch(path, credentials, data, callback) {
  this.request('patch', path, credentials, data, callback);
};

httpClient.prototype.request = function request(method, path, credentials, data, callback) {
  agent[method](url.join(this.baseUrl, path))
    .set('Authorization', credentials.getAuthHeader())
    .set('Accept', 'application/json')
    .send(data)
    .end(function onHttpResponse(err, response) {
      if (err) {
        callback(buildError(err.response, err));
        return;
      }

      if (!response.ok) {
        callback(buildError(response, null));
        return;
      }

      callback(null, object.toCamelKeys(response.body));
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
