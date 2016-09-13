'use strict';

/**
 * Utility methods to manipulate objects and primitives, kind of simple and
 * minimal version of lodash
 */

const camelCase = require('lodash.camelcase');
const snakeCase = require('lodash.snakecase');

const INTEGER_REGEXP = /^[0-9]+$/;
const ALPHANUMERIC_REGEXP = /^[0-9A-Za-z]+$/;

/**
 * Returns true for js objects, including arrays but not for null
 */
const isObject = exports.isObject = function isObject(obj) {
  if (obj === null) {
    return false;
  }

  return typeof obj === 'object';
};

const isArray = exports.isArray = function isArray(obj) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(obj);
  }

  return typeof obj === 'object' && typeof obj.length === 'number';
};

const forEach = exports.forEach = function forEach(obj, fn) {
  if (!obj) {
    return obj;
  }

  if (isArray(obj)) {
    return iterateArray(obj, fn);
  } else if (isObject(obj)) {
    return iterateObject(obj, fn);
  }
};

const reduce = exports.reduce = function reduce(obj, fn, init) {
  let current = init;

  forEach(obj, function(value, key) {
    current = fn(current, value, key, obj);
  });

  return current;
};

const some = exports.some = function some(obj, fn) {
  let found = false;

  forEach(obj, function someIterator(value, key, arr) {
    if (value === fn(value, key, arr)) {
      found = true;
      return false
    }
  });

  return found;
};

const toArray = exports.toArray = function toArray(obj) {
  if (!obj) {
    return obj;
  }

  return Array.prototype.slice.call(obj, 0);
};

const isIntegerString = exports.isIntegerString = function isIntegerString(str) {
  return !!str && !!INTEGER_REGEXP.exec(str);
};

const isAlphaNumeric = exports.isAlphaNumeric = function isAlphaNumeric(str) {
  return !!str && !!ALPHANUMERIC_REGEXP.exec(str);
};

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

const assignOne = exports.assignOne = function assignOne(root, setObj) {
  forEach(setObj, (value, key) => {
    root[key] = value;
  });

  return root;
};

const assign = exports.assign = function assign(root) {
  const rest = toArray(arguments).slice(1);

  forEach(rest, function(obj) {
    assignOne(root, obj);
  });

  return root;
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

function iterateObject(obj, fn) {
  if (!obj) {
    return obj;
  }

  const keys = Object.keys(obj);

  iterateArray(keys, (key) => fn(obj[key], key, obj));
}

function iterateArray(arr, fn) {
  if (!arr) {
    return arr;
  }

  for (let index = 0; index < arr.length; index++) {
    if (fn(arr[index], index, arr) === false) {
      return;
    }
  }
}
