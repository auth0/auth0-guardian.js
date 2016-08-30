'use strict';

/**
 * Promise based request library
 */

const Promise = require('bluebird');

exports.get = function get(uri, token) {
  return request('get', uri, token);
};

exports.put = function put(uri, token) {
  return request('put', uri, token, data);
};

exports.post = function post(uri, token, data) {
  return request('post', uri, token, data);
};

exports.del = function del(uri, token, data) {
  return request('delete', uri, token, data);
};

exports.patch = function patch(uri, token, data) {
  return request('patch', uri, token, data);
};

function request(method, uri, token, data) {
  return Promise.resolve({});
}
