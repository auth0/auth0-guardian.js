'use strict';

var INTEGER_REGEXP = /^[0-9]+$/;
var ALPHANUMERIC_REGEXP = /^[0-9A-Za-z]+$/;

/**
 * Convert an string to camelCase
 *
 * @param {string} str string to convert
 *
 * @returns {string}
 */
var camelCase = exports.camelCase = function camelCase(str) {
  if (!str) {
    return str;
  }

  // 1. Replaces whitespace character (space, tab, cr, ln, vertical tab, underscore and form feed)
  // followed by a  uppercarse version of that character
  // 2. Removes whitespace characters
  // 3. Turn first character to lowercase
  return str.toString()
    .replace(/[\s_-](.)/g, function uppercarse($1) {
      return $1.toUpperCase();
    })
    .replace(/[\s_-]/g, '')
    .replace(/^(.)/, function uncapitalize($1) {
      return $1.toLowerCase();
    });
};

/**
 * Convers an string to snakeCase
 *
 * @param {string} string to convert
 *
 * @returns {string}
 */
var snakeCase = exports.snakeCase = function snakeCase(str) {
  if (!str) {
    return str;
  }

  return str.toString().replace(/([A-Z])/g, function separate($1) {
    return '_' + $1.toLowerCase();
  })
  .replace(/-/g, '_');
};

/**
 * Returns true for js objects, including arrays but not for null
 *
 * @param {object} obj Object to check
 *
 * @returns {boolean}
 */
var isObject = exports.isObject = function isObject(obj) {
  if (obj === null) {
    return false;
  }

  return typeof obj === 'object';
};

/**
 * Returns true if a given object is an array
 *
 * @param {object} obj Object to check
 * @returns {boolean} True for arrays; false otherwise
 */
var isArray = exports.isArray = function isArray(obj) {
  if (typeof Array.isArray === 'function') {
    return Array.isArray(obj);
  }

  return typeof obj === 'object' && typeof obj.length === 'number';
};

/**
 * Returns true if a given object is an string
 *
 * @param {any} obj Object to check
 * @returns {boolean} True for arrays; false otherwise
 */
exports.isString = function isString(obj) {
  return typeof obj === 'string';
};

/**
 * Executes fn for each value of object / array. Will stop if fn
 * returns false.
 *
 * @param {object|array} obj Object to iterate
 * @param {function(value, key, obj)} function to execute, last param is
 *  the original object/array
 */
var forEach = exports.forEach = function forEach(obj, fn) {
  if (!obj) {
    return obj;
  }

  if (isArray(obj)) {
    return iterateArray(obj, fn);
  } else if (isObject(obj)) {
    return iterateObject(obj, fn);
  }

  throw new Error('Invalid iteratee');
};

/**
 * Reducer function
 *
 * @param {object|array} obj object to check
 * @param {function} fn detector function
 * @param {any} initial value
 *
 * @returns {any} the last result of executing reducer function
 */
var reduce = exports.reduce = function reduce(obj, fn, init) {
  var current = init;

  forEach(obj, function iterator(value, key) {
    current = fn(current, value, key, obj);
  });

  return current;
};

/**
 * Mapper function
 *
 * @param {object|array} obj object map
 * @param {function} fn map function
 *
 * @returns {any} array of mapped values
 */
exports.map = function map(obj, fn) {
  return reduce(obj, function iterator(current, value, key) {
    current.push(fn(value, key));

    return current;
  }, []);
};

/**
 * Returns true if fn(value, key, arr/obj) returns true
 * for any value of the array / object key-value
 *
 * @param {object|array} obj object to check
 * @param {function} fn detector function
 *
 * @returns {boolean} true if found, false otherwise
 */
exports.some = function some(obj, fn) {
  var found = false;

  forEach(obj, function someFinder(value, key, arr) {
    if (fn(value, key, arr)) {
      found = true;
      return false;
    }

    return true;
  });

  return found;
};

/**
 * Returns true if fn(value, key, arr/obj) returns true
 * for all values of the array / object key-value
 *
 * @param {object|array} obj object to check
 * @param {function} fn detector function
 *
 * @returns {boolean} true all match fn
 */
exports.every = function some(obj, fn) {
  var found = true;

  forEach(obj, function someFinder(value, key, arr) {
    if (fn(value, key, arr)) {
      return true;
    }

    found = false;
    return false;
  });

  return found;
};

/**
 * Returns the value for witch fn(value, key, arr/obj) returns a truthy value
 *
 * @param {object|array} obj object to check
 * @param {function} fn detector function
 *
 * @returns {any} value for which fn(value, key, arr/obj) is truthy
 */
exports.find = function find(obj, fn) {
  var found;

  forEach(obj, function finder(value, key, arr) {
    if (fn(value, key, arr)) {
      found = value;
      return false;
    }

    return true;
  });

  return found;
};

/**
 * Returns an array of values for witch fn(value, key, arr/obj) returns a truthy value
 *
 * @param {object|array} obj object to check
 * @param {function} fn detector function
 *
 * @returns {array.<any>} values for which fn(value, key, arr/obj) is truthy
 */
exports.filter = function filter(obj, fn) {
  return reduce(obj, function finder(found, value, key, arr) {
    if (fn(value, key, arr)) {
      found.push(value);
    }

    return found;
  }, []);
};

/**
 * Transforms an array-like object to a real array object
 *
 * @param {object} obj array like object
 *
 * @returns {boolean}
 */
var toArray = exports.toArray = function toArray(obj) {
  if (!obj) {
    return obj;
  }

  return Array.prototype.slice.call(obj, 0);
};

/**
 * Returns true if string contains only numbers
 *
 * @param {string} str string to check
 *
 * @returns {boolean}
 */
exports.isIntegerString = function isIntegerString(str) {
  return !!str && !!INTEGER_REGEXP.exec(str);
};

/**
 * Returns true if string contains only numbers and a-z characters
 * in any case
 *
 * @param {string} str string to check
 *
 * @returns {boolean}
 */
exports.isAlphaNumeric = function isAlphaNumeric(str) {
  return !!str && !!ALPHANUMERIC_REGEXP.exec(str);
};

/**
 * Transforms all keys an values of a single level object according to
 * transformKey and transformValue params
 *
 * @param {object} obj Object to transform
 * @param {function} transformKey Key transformation function
 * @param {function} transformValue Value transformation function
 *
 * @returns {object} result object
 */
var mapKeyValue = exports.mapKeyValue = function mapKeyValue(obj,
  transformKey, transformValue) {
  return reduce(obj, function mapper(transformed, currentValue, currentKey) {
    var tkey = transformKey(currentKey, currentValue);
    transformed[tkey] = transformValue(currentKey, currentValue); // eslint-disable-line no-param-reassign,max-len

    return transformed;
  }, isArray(obj) ? [] : {});
};

/**
 * Transforms all keys an values of a multilevel object according to
 * transformKey and transformValue params
 *
 * @param {object} obj Object to transform
 * @param {function} transformKey Key transformation function
 * @param {function} transformValue Value transformation function
 *
 * @returns {object} result object
 */
var deepMapKeyValue = exports.deepMapKeyValue = function deepMapKeyValue(obj,
  transformKey, transformValue) {
  return mapKeyValue(obj, transformKey, function mapper(key, value) {
    if (isObject(value)) {
      return deepMapKeyValue(value, transformKey, transformValue);
    }

    return transformValue(key, value, transformValue);
  });
};

/**
 * Single level assign
 *
 * @param {object} root Object to assign to
 * @param {object} setObj Object to take properties from
 *
 * @returns {object} result object
 */
var assignOne = exports.assignOne = function assignOne(root, setObj) {
  forEach(setObj, function mapper(value, key) {
    root[key] = value; // eslint-disable-line no-param-reassign
  });

  return root;
};

/**
 * Assign, like Object.assign but cross browser
 *
 * @param {root} Object to assign to
 * @param {object} ...rest Object to take properties from last one takes
 *   priority in case of name clash
 *
 * @returns {object} result object
 */
exports.assign = function assign(root) {
  var rest = toArray(arguments).slice(1);

  forEach(rest, function assignOneIterator(obj) {
    assignOne(root, obj);
  });

  return root;
};


/**
 * Deep transforms all keys in camel case
 *
 * @param {object} object
 */
exports.toCamelKeys = function toCamelKeys(obj) {
  return deepMapKeyValue(obj, camelCase, function valueMapper(key, value) { return value; });
};


/**
 * Deep transforms all keys in snake case
 *
 * @param {object} object
 */
exports.toSnakeKeys = function toSnakeKeys(obj) {
  return deepMapKeyValue(obj, snakeCase, function valueMapper(key, value) { return value; });
};

/**
 * Cross-browser Object.create version
 *
 * From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Polyfill
 *
 * @param {object} prototype prototype object
 * @param {object} propertiesObject properties def object
 *
 * @returns {object} object that inherits from prototype
 */
exports.create = (function createFactory() {
  var Temp = function Temp() {};
  return function create(prototype, propertiesObject) {
    if (typeof Object.create === 'function') {
      return Object.create(prototype, propertiesObject);
    }

    if (prototype !== Object(prototype) && prototype !== null) {
      throw new TypeError('Argument must be an object, or null');
    }
    Temp.prototype = prototype || {};
    var result = new Temp();
    Temp.prototype = null;
    if (propertiesObject !== undefined) {
      Object.defineProperties(result, propertiesObject);
    }

    // to imitate the case of Object.create(null)
    if (prototype === null) {
      result.__proto__ = null; // eslint-disable-line no-proto
    }
    return result;
  };
}());

var hasOwnProperty = exports.hasOwnProperty = function hasOwnProperty(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
};

/**
 * Gets a property from obj; returns default if property is
 * not defined
 *
 * @param {object} obj object to get props from
 * @param {string|array} path (array of keys or dot separated path)
 * @param {any} def default value
 */
var get = exports.get = function get(obj, path, def) {
  var segments = isArray(path) ? path : path.split('.');

  if (!isObject(obj)) {
    return undefined;
  }

  var level = obj;
  var result;
  forEach(segments, function pathGetter(segment) {
    if (level[segment] != null) {
      level = level[segment];
      result = level;
      return true;
    }

    result = def;
    return false;
  });

  return result;
};

/**
 * Sets a property onto obj, creates intermediate objects
 * if needed
 *
 * @param {object} obj object to get props from
 * @param {string|array} path (array of keys or dot separated path)
 * @param {any} value value to set
 */
exports.set = function set(obj, path, value) {
  var segments = isArray(path) ? path : path.split('.');

  var level = obj;
  forEach(segments, function pathSetter(segment, i) {
    if (i === segments.length - 1) {
      level[segment] = value;
      return;
    }

    if (!hasOwnProperty(level, segment) || !isObject(level[segment])) {
      level[segment] = {};
    }

    level = level[segment];
  });

  return obj;
};

/**
 * Returns the items that are in both arrays (comparison ===)
 *
 * @param {array} arr1
 * @param {array} arr2
 */
exports.intersec = function intersec(arr1, arr2) {
  return reduce(arr1, function intersecReducer(result, value) {
    if (arr2.indexOf(value) >= 0) {
      result.push(value);
    }

    return result;
  }, []);
};

/**
 * Executes the method if it exists (undefined otherwise)
 *
 * @param {object} obj
 * @param {array.<string>} methodPath dot separated path
 */
exports.execute = function execute(obj, methodPath) {
  var args = toArray(arguments).slice(2);
  var fn = get(obj, methodPath);

  if (fn) {
    return fn.apply(obj, args);
  }

  return undefined;
};

/**
 * Returns true if array contains the value (search by reference for objects)
 *
 * @param {array.<string>} array
 * @param {any} value
 */
exports.contains = function contains(array, value) {
  if (!array) {
    return false;
  }

  return array.indexOf(value) >= 0;
};

/**
 * No operation
 */
exports.noop = function noop() {};

function iterateObject(obj, fn) {
  if (!obj) {
    return obj;
  }

  var keys = Object.keys(obj);

  return iterateArray(keys, function iterator(key) { return fn(obj[key], key, obj); });
}

function iterateArray(arr, fn) {
  if (!arr) {
    return arr;
  }

  for (var index = 0; index < arr.length; index++) {
    if (fn(arr[index], index, arr) === false) {
      return null;
    }
  }

  return null;
}
