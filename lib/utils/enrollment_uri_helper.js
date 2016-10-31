'use strict';

var url = require('url');

/**
 * @param {string} data.issuerLabel
 * @param {string} data.otpSecret
 * @param {string} [data.enrollmentTransactionId]
 * @param {string} [data.issuerName]
 * @param {string} [data.enrollmentId]
 * @param {string} [data.baseUrl]
 * @param {string} [data.algorithm]
 * @param {integer} [data.digits]
 * @param {integer} [data.counter]
 * @param {integer} [data.period]
 */
module.exports = function enrollmentUriHelper(data) {
  var query = {};

  query.secret = data.otpSecret;

  if (data.enrollmentTransactionId != null) {
    query.enrollment_tx_id = data.enrollmentTransactionId;
  }

  if (data.issuerName != null) {
    query.issuer = data.issuerName;
  }

  if (data.enrollmentId != null) {
    query.id = data.enrollmentId;
  }

  if (data.baseUrl != null) {
    query.base_url = data.baseUrl;
  }

  if (data.algorithm != null) {
    query.algorithm = data.algorithm;
  }

  if (data.digits != null) {
    query.digits = data.digits;
  }

  if (data.counter != null) {
    query.counter = data.counter;
  }

  if (data.period != null) {
    query.period = data.period;
  }

  return url.format({
    protocol: 'otpauth:',
    host: '//totp/',
    pathname: encodeURIComponent(data.issuerLabel),
    query: query
  });
};
