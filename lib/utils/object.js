'use strict';

const camelCase = require('lodash.camelcase');
const snakeCase = require('lodash.snakeCase');
const reduce = require('lodash.reduce');
const isObject = require('lodash.isObject');
const isArray = require('lodash.isArray');

const mapKeyValue = exports.mapKeyValue = function mapKeyValue(obj, transformKey, transformValue) {
  return reduce(obj, function kvMapper(transformed, currentValue, currentKey) {
    transformed[transformKey(currentKey, currentValue)] = transformValue(currentKey, currentValue);

    return transformed;
  }, isArray(obj) ? [] : {});
};

const deepMapKeyValue = exports.deepMapKeyValue = function deepMapKeyValue(obj, transformKey, transformValue) {
  return mapKeyValue(obj, transformKey, function(key, value) {
    if (isObject(value)) {
      return deepMapKeyValue(value, transformKey, transformValue);
    }

    return transformValue(key, value, transformValue);
  });
};

/**
 * Deep transforms all keys in camel case
 */
exports.toCamelKeys = function toCamelKeys(obj) {
  return deepMapKeyValue(obj, camelCase, (key, value) => value);
};

/**
 * Deep transforms all keys in snake case
 */
exports.toSnakeKeys = function toSnakeKeys(obj) {
  return deepMapKeyValue(obj, snakeCase, (key, value) => value);
};


