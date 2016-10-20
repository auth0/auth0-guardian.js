'use strict';

var object = require('./object');
var urlUtils = require('url');

/**
 * Joins url
 *
 * @param {string} ...segments url segments
 */
exports.join = function join() {
  var args = object.toArray(arguments);
  args = object.map(args, clearTraliningSlash);
  args = object.map(args, clearStartingSlash);

  return args.join('/');
};

/**
 * Formats url
 *
 * @param {string} urlObj.protocol
 * @param {string} urlObj.host
 * @param {string} urlObj.pathname
 */
exports.format = function format(urlObj) {
  return urlUtils.format(urlObj);
};

/**
 * Parses url
 *
 * @param {string} url
 */
exports.parse = function parse(url) {
  return urlUtils.parse(url);
};

function clearTraliningSlash(partial) {
  return partial.replace(/\/+$/, '');
}

function clearStartingSlash(partial) {
  return partial.replace(/^\/+/, '');
}
