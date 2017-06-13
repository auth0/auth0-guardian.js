(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["auth0GuardianJS"] = factory();
	else
		root["auth0GuardianJS"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(1);


/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {'use strict';
	
	var form = __webpack_require__(2);
	var asyncHelpers = __webpack_require__(4);
	var errors = __webpack_require__(8);
	var object = __webpack_require__(3);
	var jwtToken = __webpack_require__(24);
	var auth0Ticket = __webpack_require__(29);
	var httpClient = __webpack_require__(30);
	var transactionFactory = __webpack_require__(47);
	var clientFactory = __webpack_require__(66);
	
	var apiTransport = {
	  polling: 'polling',
	  manual: 'polling',
	  socket: 'socket'
	};
	
	/**
	 * @public
	 *
	 * @param {string} options.serviceUrl Service base url
	 * @example `
	 *  For US: https://{name}.guardian.auth0.com
	 *  For AU: https://{name}.au.guardian.auth0.com
	 *  For EU: https://{name}.eu.guardian.auth0.com
	 * `
	 * @param {string} options.requestToken Request token got from auth0
	 * @param {string} options.issuer.label User friendly label for the issuer to
	 *  be used on google-authenticator-like apps
	 * @param {string} options.issuer.name Unique identifier of the issuer to
	 *  be used on google-authenticator-like apps
	 * @param {string} [options.globalTrackingId] Id used to associate the request
	 * in the transaction (that includes both Guardian and Auth0-server requests)
	 * @param {string} options.accountLabel
	 *
	 * @deprecated @param {string} [options.transport] Use stateCheckingMechanism
	 * @param {string} [options.stateCheckingMechanism]
	 *
	 * @param {SocketClient} [options.dependencies.socketClient] Client factory for socket api
	 * @param {function(serviceUrl)} [options.dependencies.httpClient] Client factory for http
	 */
	function auth0GuardianJS(options) {
	  var self = object.create(auth0GuardianJS.prototype);
	
	  self.serviceUrl = options.serviceUrl;
	  self.credentials = authFactory(options);
	  self.issuer = options.issuer;
	  self.accountLabel = options.accountLabel;
	
	  var globalTrackingId = options.globalTrackingId;
	
	  self.httpClient = object.get(options, 'dependencies.httpClient',
	    httpClient(self.serviceUrl, globalTrackingId));
	
	  self.transport = options.transport || options.stateCheckingMechanism || 'socket';
	
	  self.socketClient = clientFactory.create({
	    serviceUrl: self.serviceUrl,
	    transport: self.transport,
	    httpClient: self.httpClient,
	    dependency: object.get(options, 'dependencies.socketClient')
	  });
	
	  return self;
	}
	
	function authFactory(options) {
	  if (options.ticket) {
	    return auth0Ticket(options.ticket);
	  }
	
	  return jwtToken(options.requestToken);
	}
	
	/**
	 * @public
	 *
	 * Starts a new transaction
	 *
	 * @param {function(err, transaction)} callback
	 */
	auth0GuardianJS.prototype.start = function start(callback) {
	  var self = this;
	
	  if (self.credentials.isExpired()) {
	    asyncHelpers.setImmediate(callback, new errors.CredentialsExpiredError());
	    return;
	  }
	
	  self.httpClient.post('/api/start-flow',
	    self.credentials,
	    // TODO: polling is not a good name for api state checking since
	    // it could be polling or manual checking
	    { state_transport: apiTransport[self.transport] },
	    function startTransaction(err, txLegacyData) {
	      if (err) {
	        callback(err);
	        return;
	      }
	
	      var transactionToken = jwtToken(txLegacyData.transactionToken);
	
	      self.socketClient.connect(transactionToken,
	        function onSocketConnection(connectErr) {
	          if (connectErr) {
	            callback(connectErr);
	            return;
	          }
	
	          var tx;
	          try {
	            tx = transactionFactory.fromStartFlow({
	              transactionToken: transactionToken,
	              txLegacyData: txLegacyData,
	              issuer: self.issuer,
	              serviceUrl: self.serviceUrl,
	              accountLabel: self.accountLabel
	            }, {
	              transactionEventsReceiver: self.socketClient,
	              httpClient: self.httpClient
	            });
	          } catch (transactionBuildingErr) {
	            callback(transactionBuildingErr);
	            return;
	          }
	
	          callback(null, tx);
	        });
	    });
	};
	
	/**
	 * @public
	 *
	 * Takes a parameter returned from transaction.serialize to resume the transaction
	 * with auth0-mfa-api
	 *
	 * @param {string} transactionState.transactionToken
	 *
	 * @param {undefined|Object} transactionState.enrollmentAttempt
	 * @param {Object} transactionState.enrollmentAttempt.data - @see enrollmentAttempt
	 * @param {boolean} transactionState.enrollmentAttempt.active
	 *
	 * @param {object[]} transactionState.enrollments - @see enrollment
	
	 * @param {object} transactionState.availableEnrollmentMethods
	 * @param {object} transactionState.availableAuthenticationMethods
	 *
	 * @param {string} transactionState.baseUrl
	
	 * @deprecated @param {string} [options.transport] Use stateCheckingMechanism
	 * @param {string} [options.stateCheckingMechanism]
	 *
	 * @param {SocketClient} [options.dependencies.socketClient] Client factory for socket api
	 * @param {function(serviceUrl)} [options.dependencies.httpClient] Client factory for http
	 */
	
	auth0GuardianJS.resume = function resume(options, transactionState, callback) {
	  try {
	    var transactionTokenObject;
	    transactionTokenObject = jwtToken(transactionState.transactionToken);
	
	    var txId = transactionTokenObject.getDecoded().txid;
	
	    // create httpClient/socketClient
	    var httpClientInstance = object.get(options, 'dependencies.httpClient',
	      httpClient(transactionState.baseUrl, txId));
	
	    var transport = options.transport || options.stateCheckingMechanism || 'socket';
	
	    if (transactionTokenObject.isExpired()) {
	      asyncHelpers.setImmediate(callback, new errors.CredentialsExpiredError());
	      return;
	    }
	
	    var socketClient = clientFactory.create({
	      serviceUrl: transactionState.baseUrl,
	      transport: transport,
	      httpClient: httpClientInstance,
	      dependency: object.get(options, 'dependencies.socketClient')
	    });
	
	    // connect
	    socketClient.connect(transactionState.transactionToken,
	      function onSocketConnection(connectErr) {
	        if (connectErr) {
	          callback(connectErr);
	          return;
	        }
	        var tx;
	
	        try {
	          tx = transactionFactory.fromTransactionState(transactionState, {
	            transactionEventsReceiver: socketClient,
	            httpClient: httpClientInstance
	          });
	        } catch (transactionBuildingErr) {
	          callback(transactionBuildingErr);
	          return;
	        }
	
	        callback(null, tx);
	      });
	  } catch (err) {
	    if (err.name === 'InvalidTokenError') {
	      asyncHelpers.setImmediate(callback, new errors.InvalidToken('Invalid transaction token'));
	      return;
	    }
	
	    asyncHelpers.setImmediate(callback, err);
	  }
	};
	
	
	/**
	 * @public
	 *
	 * Post result to url using a standard form
	 *
	 * @param {string} url url to post
	 * @param {object} obj result with signature to post
	 */
	auth0GuardianJS.formPostHelper = function formPostHelper(url, obj) {
	  form({ document: global.document }).post(url, obj);
	};
	
	
	module.exports = auth0GuardianJS;
	
	/**
	 * Interface for classes that represent a way to get the transaction state
	 *
	 * @interface SocketClient
	 */
	
	/**
	 * Starts a connection to the server to get the transaction state
	 *
	 * @function
	 * @name SocketClient#connect
	 *
	 * @param {JWTToken} token transaction token
	 * @param {function(err)} callback callback for when connection is stablished
	 */
	
	/**
	 * Adds a listener for transaction events
	 *
	 * @function
	 * @name SocketClient#on
	 *
	 * @param {string} event event name
	 * @param {function(payload)} handler event handler
	 */
	
	/**
	 * Adds a listener for transaction events that is removed after event is
	 * fired one time
	 *
	 * @function
	 * @name SocketClient#once
	 *
	 * @param {string} event event name
	 * @param {function(payload)} handler event handler
	 */
	
	/**
	 * Removes a particular event listener
	 *
	 * @function
	 * @name SocketClient#removeListener
	 *
	 * @param {string} event event name
	 * @param {function(payload)} handler event handler
	 */
	
	/**
	 * Removes all event listener for the particular event, if the event is not
	 * provided all event listeners will be removed
	 *
	 * @function
	 * @name SocketClient#removeAllListeners
	 *
	 * @param {string} [event] event name
	 */
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * Browser ONLY
	 *
	 * Methods to create an manipulate HTML Forms
	 */
	
	var object = __webpack_require__(3);
	
	/**
	 * @param {BrowserDocument} options.document
	 */
	function form(options) {
	  var document = options.document;
	
	  var self = object.create(form.prototype);
	  self.document = document;
	
	  return self;
	}
	
	
	/**
	 * Post an object to a form
	 *
	 * @param {string} path
	 * @param {object} params
	 */
	form.prototype.post = function post(path, params) {
	  var method = 'post';
	
	  var document = this.document;
	  var formElement = document.createElement('form');
	  formElement.setAttribute('method', method);
	  formElement.setAttribute('action', path);
	
	  object.forEach(params, function fieldIterator(value, key) {
	    var hiddenField = document.createElement('input');
	    hiddenField.setAttribute('type', 'hidden');
	    hiddenField.setAttribute('name', key);
	    hiddenField.setAttribute('value', value);
	
	    formElement.appendChild(hiddenField);
	  });
	
	  document.body.appendChild(formElement);
	
	  formElement.submit();
	
	  if (document.body.removeChild) {
	    document.body.removeChild(formElement);
	  }
	};
	
	module.exports = form;


/***/ }),
/* 3 */
/***/ (function(module, exports) {

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


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(setImmediate) {'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * Behaves like standard setImmediate if possible, otherwise fallbaks to
	 * setTimeout(() => fn(args), 0)
	 *
	 * @param {function} fn function to call
	 * @param {any} ...args args to call function
	 */
	exports.setImmediate = function setImmediatePF(fn) {
	  var args = object.toArray(arguments).slice(1);
	
	  if (typeof setImmediate === 'function') {
	    setImmediate.apply(null, [fn].concat(args));
	    return;
	  }
	
	  setTimeout(function setImmediateTimeout() {
	    fn.apply(null, args);
	  }, 0);
	};
	
	/**
	 * Executes a set of tasks in parallel, callbacks immediatelly if there is an error,
	 * returns all callbacks with an array of results once all have finished otherwise
	 *
	 * @param {array.<function(done)>} tasks tasks to execute
	 * @param {function} callback final callback
	 */
	exports.all = function all(tasks, callback) {
	  var finished = false;
	  var pending = tasks.length;
	  var results = new Array(tasks.length);
	
	  var resultCollecter = function resultCollecter(i) {
	    return function wrapper(err, result) {
	      if (finished) {
	        return; // Discard if already finished
	      }
	
	      if (err) {
	        finished = true;
	        callback(err);
	        return;
	      }
	
	      pending -= 1;
	      results[i] = result;
	
	      if (pending === 0) {
	        finished = true;
	        callback(null, results);
	        return;
	      }
	    };
	  };
	
	  object.forEach(tasks, function taskIterator(task, i) {
	    task(resultCollecter(i));
	  });
	};
	
	/**
	 * Callbacks on the first task that get fullfiled or returns error
	 *
	 * @param {array.<function(done)>} tasks
	 * @param {function} callback
	 */
	exports.any = function any(tasks, callback) {
	  var finished = false;
	
	  var errorCount = 0;
	  var errors = [];
	
	  var wrapper = function wrapper(i) {
	    return function resultCollecterHandler(err, result) {
	      if (finished) {
	        return; // Discard if already finished
	      }
	
	      if (err) {
	        errors[i] = err;
	        errorCount += 1;
	
	        if (errorCount === tasks.length) {
	          finished = true;
	          var error = new Error();
	          error.message = 'All events have failed';
	          error.internals = errors;
	          callback(error);
	          return;
	        }
	
	        return;
	      }
	
	      finished = true;
	      callback(null, result);
	    };
	  };
	
	  object.forEach(tasks, function taskIterator(task, index) {
	    task(wrapper(index));
	  });
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(5).setImmediate))

/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

	var apply = Function.prototype.apply;
	
	// DOM APIs, for completeness
	
	exports.setTimeout = function() {
	  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
	};
	exports.setInterval = function() {
	  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
	};
	exports.clearTimeout =
	exports.clearInterval = function(timeout) {
	  if (timeout) {
	    timeout.close();
	  }
	};
	
	function Timeout(id, clearFn) {
	  this._id = id;
	  this._clearFn = clearFn;
	}
	Timeout.prototype.unref = Timeout.prototype.ref = function() {};
	Timeout.prototype.close = function() {
	  this._clearFn.call(window, this._id);
	};
	
	// Does not start the time, just sets up the members needed.
	exports.enroll = function(item, msecs) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = msecs;
	};
	
	exports.unenroll = function(item) {
	  clearTimeout(item._idleTimeoutId);
	  item._idleTimeout = -1;
	};
	
	exports._unrefActive = exports.active = function(item) {
	  clearTimeout(item._idleTimeoutId);
	
	  var msecs = item._idleTimeout;
	  if (msecs >= 0) {
	    item._idleTimeoutId = setTimeout(function onTimeout() {
	      if (item._onTimeout)
	        item._onTimeout();
	    }, msecs);
	  }
	};
	
	// setimmediate attaches itself to the global object
	__webpack_require__(6);
	exports.setImmediate = setImmediate;
	exports.clearImmediate = clearImmediate;


/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global, process) {(function (global, undefined) {
	    "use strict";
	
	    if (global.setImmediate) {
	        return;
	    }
	
	    var nextHandle = 1; // Spec says greater than zero
	    var tasksByHandle = {};
	    var currentlyRunningATask = false;
	    var doc = global.document;
	    var registerImmediate;
	
	    function setImmediate(callback) {
	      // Callback can either be a function or a string
	      if (typeof callback !== "function") {
	        callback = new Function("" + callback);
	      }
	      // Copy function arguments
	      var args = new Array(arguments.length - 1);
	      for (var i = 0; i < args.length; i++) {
	          args[i] = arguments[i + 1];
	      }
	      // Store and register the task
	      var task = { callback: callback, args: args };
	      tasksByHandle[nextHandle] = task;
	      registerImmediate(nextHandle);
	      return nextHandle++;
	    }
	
	    function clearImmediate(handle) {
	        delete tasksByHandle[handle];
	    }
	
	    function run(task) {
	        var callback = task.callback;
	        var args = task.args;
	        switch (args.length) {
	        case 0:
	            callback();
	            break;
	        case 1:
	            callback(args[0]);
	            break;
	        case 2:
	            callback(args[0], args[1]);
	            break;
	        case 3:
	            callback(args[0], args[1], args[2]);
	            break;
	        default:
	            callback.apply(undefined, args);
	            break;
	        }
	    }
	
	    function runIfPresent(handle) {
	        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
	        // So if we're currently running a task, we'll need to delay this invocation.
	        if (currentlyRunningATask) {
	            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
	            // "too much recursion" error.
	            setTimeout(runIfPresent, 0, handle);
	        } else {
	            var task = tasksByHandle[handle];
	            if (task) {
	                currentlyRunningATask = true;
	                try {
	                    run(task);
	                } finally {
	                    clearImmediate(handle);
	                    currentlyRunningATask = false;
	                }
	            }
	        }
	    }
	
	    function installNextTickImplementation() {
	        registerImmediate = function(handle) {
	            process.nextTick(function () { runIfPresent(handle); });
	        };
	    }
	
	    function canUsePostMessage() {
	        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
	        // where `global.postMessage` means something completely different and can't be used for this purpose.
	        if (global.postMessage && !global.importScripts) {
	            var postMessageIsAsynchronous = true;
	            var oldOnMessage = global.onmessage;
	            global.onmessage = function() {
	                postMessageIsAsynchronous = false;
	            };
	            global.postMessage("", "*");
	            global.onmessage = oldOnMessage;
	            return postMessageIsAsynchronous;
	        }
	    }
	
	    function installPostMessageImplementation() {
	        // Installs an event handler on `global` for the `message` event: see
	        // * https://developer.mozilla.org/en/DOM/window.postMessage
	        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages
	
	        var messagePrefix = "setImmediate$" + Math.random() + "$";
	        var onGlobalMessage = function(event) {
	            if (event.source === global &&
	                typeof event.data === "string" &&
	                event.data.indexOf(messagePrefix) === 0) {
	                runIfPresent(+event.data.slice(messagePrefix.length));
	            }
	        };
	
	        if (global.addEventListener) {
	            global.addEventListener("message", onGlobalMessage, false);
	        } else {
	            global.attachEvent("onmessage", onGlobalMessage);
	        }
	
	        registerImmediate = function(handle) {
	            global.postMessage(messagePrefix + handle, "*");
	        };
	    }
	
	    function installMessageChannelImplementation() {
	        var channel = new MessageChannel();
	        channel.port1.onmessage = function(event) {
	            var handle = event.data;
	            runIfPresent(handle);
	        };
	
	        registerImmediate = function(handle) {
	            channel.port2.postMessage(handle);
	        };
	    }
	
	    function installReadyStateChangeImplementation() {
	        var html = doc.documentElement;
	        registerImmediate = function(handle) {
	            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
	            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
	            var script = doc.createElement("script");
	            script.onreadystatechange = function () {
	                runIfPresent(handle);
	                script.onreadystatechange = null;
	                html.removeChild(script);
	                script = null;
	            };
	            html.appendChild(script);
	        };
	    }
	
	    function installSetTimeoutImplementation() {
	        registerImmediate = function(handle) {
	            setTimeout(runIfPresent, 0, handle);
	        };
	    }
	
	    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
	    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
	    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;
	
	    // Don't get fooled by e.g. browserify environments.
	    if ({}.toString.call(global.process) === "[object process]") {
	        // For Node.js before 0.9
	        installNextTickImplementation();
	
	    } else if (canUsePostMessage()) {
	        // For non-IE10 modern browsers
	        installPostMessageImplementation();
	
	    } else if (global.MessageChannel) {
	        // For web workers, where supported
	        installMessageChannelImplementation();
	
	    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
	        // For IE 6–8
	        installReadyStateChangeImplementation();
	
	    } else {
	        // For older browsers
	        installSetTimeoutImplementation();
	    }
	
	    attachTo.setImmediate = setImmediate;
	    attachTo.clearImmediate = clearImmediate;
	}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }()), __webpack_require__(7)))

/***/ }),
/* 7 */
/***/ (function(module, exports) {

	// shim for using process in browser
	var process = module.exports = {};
	
	// cached from whatever global is present so that test runners that stub it
	// don't break things.  But we need to wrap it in a try catch in case it is
	// wrapped in strict mode code which doesn't define any globals.  It's inside a
	// function because try/catches deoptimize in certain engines.
	
	var cachedSetTimeout;
	var cachedClearTimeout;
	
	function defaultSetTimout() {
	    throw new Error('setTimeout has not been defined');
	}
	function defaultClearTimeout () {
	    throw new Error('clearTimeout has not been defined');
	}
	(function () {
	    try {
	        if (typeof setTimeout === 'function') {
	            cachedSetTimeout = setTimeout;
	        } else {
	            cachedSetTimeout = defaultSetTimout;
	        }
	    } catch (e) {
	        cachedSetTimeout = defaultSetTimout;
	    }
	    try {
	        if (typeof clearTimeout === 'function') {
	            cachedClearTimeout = clearTimeout;
	        } else {
	            cachedClearTimeout = defaultClearTimeout;
	        }
	    } catch (e) {
	        cachedClearTimeout = defaultClearTimeout;
	    }
	} ())
	function runTimeout(fun) {
	    if (cachedSetTimeout === setTimeout) {
	        //normal enviroments in sane situations
	        return setTimeout(fun, 0);
	    }
	    // if setTimeout wasn't available but was latter defined
	    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
	        cachedSetTimeout = setTimeout;
	        return setTimeout(fun, 0);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedSetTimeout(fun, 0);
	    } catch(e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
	            return cachedSetTimeout.call(null, fun, 0);
	        } catch(e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
	            return cachedSetTimeout.call(this, fun, 0);
	        }
	    }
	
	
	}
	function runClearTimeout(marker) {
	    if (cachedClearTimeout === clearTimeout) {
	        //normal enviroments in sane situations
	        return clearTimeout(marker);
	    }
	    // if clearTimeout wasn't available but was latter defined
	    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
	        cachedClearTimeout = clearTimeout;
	        return clearTimeout(marker);
	    }
	    try {
	        // when when somebody has screwed with setTimeout but no I.E. maddness
	        return cachedClearTimeout(marker);
	    } catch (e){
	        try {
	            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
	            return cachedClearTimeout.call(null, marker);
	        } catch (e){
	            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
	            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
	            return cachedClearTimeout.call(this, marker);
	        }
	    }
	
	
	
	}
	var queue = [];
	var draining = false;
	var currentQueue;
	var queueIndex = -1;
	
	function cleanUpNextTick() {
	    if (!draining || !currentQueue) {
	        return;
	    }
	    draining = false;
	    if (currentQueue.length) {
	        queue = currentQueue.concat(queue);
	    } else {
	        queueIndex = -1;
	    }
	    if (queue.length) {
	        drainQueue();
	    }
	}
	
	function drainQueue() {
	    if (draining) {
	        return;
	    }
	    var timeout = runTimeout(cleanUpNextTick);
	    draining = true;
	
	    var len = queue.length;
	    while(len) {
	        currentQueue = queue;
	        queue = [];
	        while (++queueIndex < len) {
	            if (currentQueue) {
	                currentQueue[queueIndex].run();
	            }
	        }
	        queueIndex = -1;
	        len = queue.length;
	    }
	    currentQueue = null;
	    draining = false;
	    runClearTimeout(timeout);
	}
	
	process.nextTick = function (fun) {
	    var args = new Array(arguments.length - 1);
	    if (arguments.length > 1) {
	        for (var i = 1; i < arguments.length; i++) {
	            args[i - 1] = arguments[i];
	        }
	    }
	    queue.push(new Item(fun, args));
	    if (queue.length === 1 && !draining) {
	        runTimeout(drainQueue);
	    }
	};
	
	// v8 likes predictible objects
	function Item(fun, array) {
	    this.fun = fun;
	    this.array = array;
	}
	Item.prototype.run = function () {
	    this.fun.apply(null, this.array);
	};
	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];
	process.version = ''; // empty string to avoid regexp issues
	process.versions = {};
	
	function noop() {}
	
	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;
	process.prependListener = noop;
	process.prependOnceListener = noop;
	
	process.listeners = function (name) { return [] }
	
	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};
	
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};
	process.umask = function() { return 0; };


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	exports.GuardianError = __webpack_require__(9);
	exports.NoMethodAvailableError = __webpack_require__(10);
	exports.CredentialsExpiredError = __webpack_require__(11);
	exports.MethodNotFoundError = __webpack_require__(12);
	exports.FieldRequiredError = __webpack_require__(13);
	exports.OTPValidationError = __webpack_require__(14);
	exports.RecoveryCodeValidationError = __webpack_require__(15);
	exports.AlreadyEnrolledError = __webpack_require__(16);
	exports.NotEnrolledError = __webpack_require__(17);
	exports.AuthMethodDisabledError = __webpack_require__(18);
	exports.EnrollmentMethodDisabledError = __webpack_require__(19);
	exports.InvalidEnrollmentError = __webpack_require__(20);
	exports.InvalidStateError = __webpack_require__(21);
	exports.UnexpectedInputError = __webpack_require__(22);
	exports.InvalidToken = __webpack_require__(23);


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	var codeMap = {
	   // TODO Remove once the new widget is up and running
	  device_account_conflict: 'enrollment_conflict',
	  device_account_not_found: 'enrollment_not_found'
	};
	
	function GuardianError(payload) {
	  var superError = Error.call(this, payload.message);
	
	  if (codeMap[payload.errorCode]) {
	    this.errorCode = codeMap[payload.errorCode];
	  } else {
	    this.errorCode = payload.errorCode;
	  }
	
	  this.statusCode = payload.statusCode;
	
	  if (payload.cause && payload.cause.stack) {
	    this.stack = payload.cause.stack;
	  } else {
	    this.stack = superError.stack;
	  }
	
	  this.message = payload.message;
	}
	
	GuardianError.prototype = object.create(Error.prototype);
	GuardianError.prototype.constructor = GuardianError;
	
	module.exports = GuardianError;


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function NoMethodAvailableError() {
	  GuardianError.call(this, {
	    message: 'No method available. ',
	    errorCode: 'no_method_available'
	  });
	}
	
	NoMethodAvailableError.prototype = object.create(GuardianError.prototype);
	NoMethodAvailableError.prototype.constructor = NoMethodAvailableError;
	
	module.exports = NoMethodAvailableError;


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function CredentialsExpiredError() {
	  GuardianError.call(this, {
	    message: 'The credentials has expired.',
	    errorCode: 'credentials_expired'
	  });
	}
	
	CredentialsExpiredError.prototype = object.create(GuardianError.prototype);
	CredentialsExpiredError.prototype.constructor = CredentialsExpiredError;
	
	module.exports = CredentialsExpiredError;


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function MethodNotFoundError(method) {
	  GuardianError.call(this, {
	    message: 'Method ' + method + 'was not found',
	    errorCode: 'method_not_found'
	  });
	}
	
	MethodNotFoundError.prototype = object.create(GuardianError.prototype);
	MethodNotFoundError.prototype.constructor = MethodNotFoundError;
	
	module.exports = MethodNotFoundError;


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function FieldRequiredError(field) {
	  GuardianError.call(this, {
	    message: field + ' is required',
	    errorCode: 'field_required'
	  });
	  this.field = field;
	}
	
	FieldRequiredError.prototype = object.create(GuardianError.prototype);
	FieldRequiredError.prototype.constructor = FieldRequiredError;
	
	module.exports = FieldRequiredError;


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function OtpValidationError() {
	  GuardianError.call(this, {
	    message: 'OTP validation error',
	    errorCode: 'invalid_otp_format'
	  });
	}
	
	OtpValidationError.prototype = object.create(GuardianError.prototype);
	OtpValidationError.prototype.constructor = OtpValidationError;
	
	module.exports = OtpValidationError;


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function RecoveryCodeValidationError() {
	  GuardianError.call(this, {
	    message: 'Recovery code validation error',
	    errorCode: 'invalid_recovery_code_format'
	  });
	}
	
	RecoveryCodeValidationError.prototype = object.create(GuardianError.prototype);
	RecoveryCodeValidationError.prototype.constructor = RecoveryCodeValidationError;
	
	module.exports = RecoveryCodeValidationError;


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function AlreadyEnrolledError() {
	  GuardianError.call(this, {
	    message: 'You cannot enroll again. You are already enrolled.',
	    errorCode: 'already_enrolled'
	  });
	}
	
	AlreadyEnrolledError.prototype = object.create(GuardianError.prototype);
	AlreadyEnrolledError.prototype.constructor = AlreadyEnrolledError;
	
	module.exports = AlreadyEnrolledError;


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function NotEnrolledError() {
	  GuardianError.call(this, {
	    message: 'You are not enrolled. Please enroll before trying to authenticate',
	    errorCode: 'not_enrolled'
	  });
	}
	
	NotEnrolledError.prototype = object.create(GuardianError.prototype);
	NotEnrolledError.prototype.constructor = NotEnrolledError;
	
	module.exports = NotEnrolledError;


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function AuthMethodDisabledError(method) {
	  GuardianError.call(this, {
	    message: 'The method ' + method + 'is disabled',
	    errorCode: 'auth_method_disabled'
	  });
	
	  this.method = method;
	}
	
	AuthMethodDisabledError.prototype = object.create(GuardianError.prototype);
	AuthMethodDisabledError.prototype.constructor = AuthMethodDisabledError;
	
	module.exports = AuthMethodDisabledError;


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function EnrollmentMethodDisabledError(method) {
	  GuardianError.call(this, {
	    message: 'The method ' + method + 'is disabled',
	    errorCode: 'enrollment_method_disabled'
	  });
	
	  this.method = method;
	}
	
	EnrollmentMethodDisabledError.prototype = object.create(GuardianError.prototype);
	EnrollmentMethodDisabledError.prototype.constructor = EnrollmentMethodDisabledError;
	
	module.exports = EnrollmentMethodDisabledError;


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function InvalidEnrollmentError() {
	  GuardianError.call(this, {
	    message: 'The enrollment provided is not valid, null or undefined',
	    errorCode: 'invalid_enrollment'
	  });
	}
	
	InvalidEnrollmentError.prototype = object.create(GuardianError.prototype);
	InvalidEnrollmentError.prototype.constructor = InvalidEnrollmentError;
	
	module.exports = InvalidEnrollmentError;


/***/ }),
/* 21 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function InvalidStateError(message) {
	  GuardianError.call(this, {
	    message: message,
	    errorCode: 'invalid_state'
	  });
	}
	
	InvalidStateError.prototype = object.create(GuardianError.prototype);
	InvalidStateError.prototype.constructor = InvalidStateError;
	
	module.exports = InvalidStateError;


/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function UnexpectedInputError(message) {
	  GuardianError.call(this, {
	    message: message,
	    errorCode: 'unexpected_input'
	  });
	}
	
	UnexpectedInputError.prototype = object.create(GuardianError.prototype);
	UnexpectedInputError.prototype.constructor = UnexpectedInputError;
	
	module.exports = UnexpectedInputError;


/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	
	function InvalidToken(message) {
	  GuardianError.call(this, {
	    message: message,
	    errorCode: 'invalid_token'
	  });
	}
	
	InvalidToken.prototype = object.create(GuardianError.prototype);
	InvalidToken.prototype.constructor = InvalidToken;
	
	module.exports = InvalidToken;


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var jwtDecode = __webpack_require__(25);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	
	function jwtToken(token) {
	  var self = object.create(jwtToken.prototype);
	  EventEmitter.apply(self);
	
	  self.token = token;
	  self.decoded = jwtDecode(token);
	
	  if (self.decoded && self.decoded.exp) {
	    var remaining = self.getRemainingTime();
	
	    self.expirationTimeout = setTimeout(function onTokenExpired() {
	      self.emit('token-expired');
	    }, remaining);
	  }
	
	  return self;
	}
	
	jwtToken.prototype = object.create(EventEmitter.prototype);
	
	jwtToken.prototype.getRemainingTime = function getRemainingTime() {
	  var exp = this.decoded.exp * 1000; // decoded.exp is in seconds
	  var remaining = exp - Date.now();
	
	  return remaining;
	};
	
	jwtToken.prototype.getAuthHeader = function getAuthHeader() {
	  return 'Bearer ' + this.token;
	};
	
	jwtToken.prototype.isExpired = function isExpired() {
	  return this.getRemainingTime() <= 0;
	};
	
	jwtToken.prototype.getToken = function getToken() {
	  return this.token;
	};
	
	jwtToken.prototype.getDecoded = function getDecoded() {
	  return this.decoded;
	};
	
	module.exports = jwtToken;


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var base64_url_decode = __webpack_require__(26);
	
	function InvalidTokenError(message) {
	  this.message = message;
	}
	
	InvalidTokenError.prototype = new Error();
	InvalidTokenError.prototype.name = 'InvalidTokenError';
	
	module.exports = function (token,options) {
	  if (typeof token !== 'string') {
	    throw new InvalidTokenError('Invalid token specified');
	  }
	
	  options = options || {};
	  var pos = options.header === true ? 0 : 1;
	  try {
	    return JSON.parse(base64_url_decode(token.split('.')[pos]));
	  } catch (e) {
	    throw new InvalidTokenError('Invalid token specified: ' + e.message);
	  }
	};
	
	module.exports.InvalidTokenError = InvalidTokenError;


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

	var atob = __webpack_require__(27);
	
	function b64DecodeUnicode(str) {
	  return decodeURIComponent(atob(str).replace(/(.)/g, function (m, p) {
	    var code = p.charCodeAt(0).toString(16).toUpperCase();
	    if (code.length < 2) {
	      code = '0' + code;
	    }
	    return '%' + code;
	  }));
	}
	
	module.exports = function(str) {
	  var output = str.replace(/-/g, "+").replace(/_/g, "/");
	  switch (output.length % 4) {
	    case 0:
	      break;
	    case 2:
	      output += "==";
	      break;
	    case 3:
	      output += "=";
	      break;
	    default:
	      throw "Illegal base64url string!";
	  }
	
	  try{
	    return b64DecodeUnicode(output);
	  } catch (err) {
	    return atob(output);
	  }
	};


/***/ }),
/* 27 */
/***/ (function(module, exports) {

	/**
	 * The code was extracted from:
	 * https://github.com/davidchambers/Base64.js
	 */
	
	var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
	
	function InvalidCharacterError(message) {
	  this.message = message;
	}
	
	InvalidCharacterError.prototype = new Error();
	InvalidCharacterError.prototype.name = 'InvalidCharacterError';
	
	function polyfill (input) {
	  var str = String(input).replace(/=+$/, '');
	  if (str.length % 4 == 1) {
	    throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
	  }
	  for (
	    // initialize result and counters
	    var bc = 0, bs, buffer, idx = 0, output = '';
	    // get next character
	    buffer = str.charAt(idx++);
	    // character found in table? initialize bit storage and add its ascii value;
	    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
	      // and if not first of each 4 characters,
	      // convert the first 8 bits to one ascii character
	      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
	  ) {
	    // try to find character in table (0-63, not found => -1)
	    buffer = chars.indexOf(buffer);
	  }
	  return output;
	}
	
	
	module.exports = typeof window !== 'undefined' && window.atob && window.atob.bind(window) || polyfill;


/***/ }),
/* 28 */
/***/ (function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	
	function EventEmitter() {
	  this._events = this._events || {};
	  this._maxListeners = this._maxListeners || undefined;
	}
	module.exports = EventEmitter;
	
	// Backwards-compat with node 0.10.x
	EventEmitter.EventEmitter = EventEmitter;
	
	EventEmitter.prototype._events = undefined;
	EventEmitter.prototype._maxListeners = undefined;
	
	// By default EventEmitters will print a warning if more than 10 listeners are
	// added to it. This is a useful default which helps finding memory leaks.
	EventEmitter.defaultMaxListeners = 10;
	
	// Obviously not all Emitters should be limited to 10. This function allows
	// that to be increased. Set to zero for unlimited.
	EventEmitter.prototype.setMaxListeners = function(n) {
	  if (!isNumber(n) || n < 0 || isNaN(n))
	    throw TypeError('n must be a positive number');
	  this._maxListeners = n;
	  return this;
	};
	
	EventEmitter.prototype.emit = function(type) {
	  var er, handler, len, args, i, listeners;
	
	  if (!this._events)
	    this._events = {};
	
	  // If there is no 'error' event listener then throw.
	  if (type === 'error') {
	    if (!this._events.error ||
	        (isObject(this._events.error) && !this._events.error.length)) {
	      er = arguments[1];
	      if (er instanceof Error) {
	        throw er; // Unhandled 'error' event
	      } else {
	        // At least give some kind of context to the user
	        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
	        err.context = er;
	        throw err;
	      }
	    }
	  }
	
	  handler = this._events[type];
	
	  if (isUndefined(handler))
	    return false;
	
	  if (isFunction(handler)) {
	    switch (arguments.length) {
	      // fast cases
	      case 1:
	        handler.call(this);
	        break;
	      case 2:
	        handler.call(this, arguments[1]);
	        break;
	      case 3:
	        handler.call(this, arguments[1], arguments[2]);
	        break;
	      // slower
	      default:
	        args = Array.prototype.slice.call(arguments, 1);
	        handler.apply(this, args);
	    }
	  } else if (isObject(handler)) {
	    args = Array.prototype.slice.call(arguments, 1);
	    listeners = handler.slice();
	    len = listeners.length;
	    for (i = 0; i < len; i++)
	      listeners[i].apply(this, args);
	  }
	
	  return true;
	};
	
	EventEmitter.prototype.addListener = function(type, listener) {
	  var m;
	
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  if (!this._events)
	    this._events = {};
	
	  // To avoid recursion in the case that type === "newListener"! Before
	  // adding it to the listeners, first emit "newListener".
	  if (this._events.newListener)
	    this.emit('newListener', type,
	              isFunction(listener.listener) ?
	              listener.listener : listener);
	
	  if (!this._events[type])
	    // Optimize the case of one listener. Don't need the extra array object.
	    this._events[type] = listener;
	  else if (isObject(this._events[type]))
	    // If we've already got an array, just append.
	    this._events[type].push(listener);
	  else
	    // Adding the second element, need to change to array.
	    this._events[type] = [this._events[type], listener];
	
	  // Check for listener leak
	  if (isObject(this._events[type]) && !this._events[type].warned) {
	    if (!isUndefined(this._maxListeners)) {
	      m = this._maxListeners;
	    } else {
	      m = EventEmitter.defaultMaxListeners;
	    }
	
	    if (m && m > 0 && this._events[type].length > m) {
	      this._events[type].warned = true;
	      console.error('(node) warning: possible EventEmitter memory ' +
	                    'leak detected. %d listeners added. ' +
	                    'Use emitter.setMaxListeners() to increase limit.',
	                    this._events[type].length);
	      if (typeof console.trace === 'function') {
	        // not supported in IE 10
	        console.trace();
	      }
	    }
	  }
	
	  return this;
	};
	
	EventEmitter.prototype.on = EventEmitter.prototype.addListener;
	
	EventEmitter.prototype.once = function(type, listener) {
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  var fired = false;
	
	  function g() {
	    this.removeListener(type, g);
	
	    if (!fired) {
	      fired = true;
	      listener.apply(this, arguments);
	    }
	  }
	
	  g.listener = listener;
	  this.on(type, g);
	
	  return this;
	};
	
	// emits a 'removeListener' event iff the listener was removed
	EventEmitter.prototype.removeListener = function(type, listener) {
	  var list, position, length, i;
	
	  if (!isFunction(listener))
	    throw TypeError('listener must be a function');
	
	  if (!this._events || !this._events[type])
	    return this;
	
	  list = this._events[type];
	  length = list.length;
	  position = -1;
	
	  if (list === listener ||
	      (isFunction(list.listener) && list.listener === listener)) {
	    delete this._events[type];
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	
	  } else if (isObject(list)) {
	    for (i = length; i-- > 0;) {
	      if (list[i] === listener ||
	          (list[i].listener && list[i].listener === listener)) {
	        position = i;
	        break;
	      }
	    }
	
	    if (position < 0)
	      return this;
	
	    if (list.length === 1) {
	      list.length = 0;
	      delete this._events[type];
	    } else {
	      list.splice(position, 1);
	    }
	
	    if (this._events.removeListener)
	      this.emit('removeListener', type, listener);
	  }
	
	  return this;
	};
	
	EventEmitter.prototype.removeAllListeners = function(type) {
	  var key, listeners;
	
	  if (!this._events)
	    return this;
	
	  // not listening for removeListener, no need to emit
	  if (!this._events.removeListener) {
	    if (arguments.length === 0)
	      this._events = {};
	    else if (this._events[type])
	      delete this._events[type];
	    return this;
	  }
	
	  // emit removeListener for all listeners on all events
	  if (arguments.length === 0) {
	    for (key in this._events) {
	      if (key === 'removeListener') continue;
	      this.removeAllListeners(key);
	    }
	    this.removeAllListeners('removeListener');
	    this._events = {};
	    return this;
	  }
	
	  listeners = this._events[type];
	
	  if (isFunction(listeners)) {
	    this.removeListener(type, listeners);
	  } else if (listeners) {
	    // LIFO order
	    while (listeners.length)
	      this.removeListener(type, listeners[listeners.length - 1]);
	  }
	  delete this._events[type];
	
	  return this;
	};
	
	EventEmitter.prototype.listeners = function(type) {
	  var ret;
	  if (!this._events || !this._events[type])
	    ret = [];
	  else if (isFunction(this._events[type]))
	    ret = [this._events[type]];
	  else
	    ret = this._events[type].slice();
	  return ret;
	};
	
	EventEmitter.prototype.listenerCount = function(type) {
	  if (this._events) {
	    var evlistener = this._events[type];
	
	    if (isFunction(evlistener))
	      return 1;
	    else if (evlistener)
	      return evlistener.length;
	  }
	  return 0;
	};
	
	EventEmitter.listenerCount = function(emitter, type) {
	  return emitter.listenerCount(type);
	};
	
	function isFunction(arg) {
	  return typeof arg === 'function';
	}
	
	function isNumber(arg) {
	  return typeof arg === 'number';
	}
	
	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}
	
	function isUndefined(arg) {
	  return arg === void 0;
	}


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	function auth0Ticket(ticket) {
	  var self = object.create(auth0Ticket.prototype);
	  self.ticket = ticket;
	
	  return self;
	}
	
	auth0Ticket.prototype.getAuthHeader = function getAuthHeader() {
	  return 'Ticket id="' + this.ticket + '"';
	};
	
	auth0Ticket.prototype.isExpired = function isExpired() {
	  return false;
	};
	
	auth0Ticket.prototype.getToken = function getToken() {
	  return this.ticket;
	};
	
	auth0Ticket.prototype.getDecoded = function getDecoded() {
	  return {};
	};
	
	module.exports = auth0Ticket;


/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var agent = __webpack_require__(31);
	var url = __webpack_require__(39);
	var object = __webpack_require__(3);
	var errors = __webpack_require__(8);
	
	/**
	 * HTTP Client library
	 *
	 * @param {object|string} base url or url object to be format with url.format
	 * @param {string} [globalTrackingId] id uses to associate the request with the
	 * secuence of request in multiple services (just for debugging purposes)
	 */
	function httpClient(baseUrl, globalTrackingId) {
	  var self = object.create(httpClient.prototype);
	
	  if (object.isString(baseUrl)) {
	    self.baseUrl = url.format(baseUrl);
	  } else {
	    self.baseUrl = baseUrl;
	  }
	
	  self.globalTrackingId = globalTrackingId;
	
	  return self;
	}
	httpClient.prototype.getBaseUrl = function getBaseUrl() {
	  return this.baseUrl;
	};
	
	httpClient.prototype.get = function get(path, credentials, options, callback) {
	  this.request('get', path, credentials, null, options, callback);
	};
	
	httpClient.prototype.put = function put(path, credentials, data, options, callback) {
	  this.request('put', path, credentials, data, options, callback);
	};
	
	httpClient.prototype.post = function post(path, credentials, data, options, callback) {
	  this.request('post', path, credentials, data, options, callback);
	};
	
	httpClient.prototype.del = function del(path, credentials, data, options, callback) {
	  this.request('delete', path, credentials, data, options, callback);
	};
	
	httpClient.prototype.patch = function patch(path, credentials, data, options, callback) {
	  this.request('patch', path, credentials, data, options, callback);
	};
	
	httpClient.prototype.request = function request(method, path, credentials,
	  data, options, callback) {
	  if (typeof options === 'function') {
	    callback = options; // eslint-disable-line no-param-reassign
	    options = {}; // eslint-disable-line no-param-reassign
	  }
	
	  options = options || {}; // eslint-disable-line no-param-reassign
	
	  var serverRequest = agent[method](url.join(this.baseUrl, path))
	    .set('Authorization', credentials.getAuthHeader())
	    .set('Accept', 'application/json');
	
	  if (this.globalTrackingId) {
	    serverRequest.set('x-global-tracking-id', this.globalTrackingId);
	  }
	
	  serverRequest
	    .send(data)
	    .end(function onHttpResponse(err, response) {
	      if (err) {
	        if (options.completeResponse) {
	          callback(err);
	        } else {
	          callback(buildError(err.response, err));
	        }
	        return;
	      }
	
	      if (!response.ok) {
	        callback(buildError(response, null));
	        return;
	      }
	
	      if (options.completeResponse) {
	        callback(null, response);
	      } else {
	        callback(null, object.toCamelKeys(response.body));
	      }
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


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Root reference for iframes.
	 */
	
	var root;
	if (typeof window !== 'undefined') { // Browser window
	  root = window;
	} else if (typeof self !== 'undefined') { // Web Worker
	  root = self;
	} else { // Other environments
	  console.warn("Using browser-only version of superagent in non-browser environment");
	  root = this;
	}
	
	var Emitter = __webpack_require__(32);
	var RequestBase = __webpack_require__(33);
	var isObject = __webpack_require__(34);
	var isFunction = __webpack_require__(35);
	var ResponseBase = __webpack_require__(36);
	var shouldRetry = __webpack_require__(38);
	
	/**
	 * Noop.
	 */
	
	function noop(){};
	
	/**
	 * Expose `request`.
	 */
	
	var request = exports = module.exports = function(method, url) {
	  // callback
	  if ('function' == typeof url) {
	    return new exports.Request('GET', method).end(url);
	  }
	
	  // url first
	  if (1 == arguments.length) {
	    return new exports.Request('GET', method);
	  }
	
	  return new exports.Request(method, url);
	}
	
	exports.Request = Request;
	
	/**
	 * Determine XHR.
	 */
	
	request.getXHR = function () {
	  if (root.XMLHttpRequest
	      && (!root.location || 'file:' != root.location.protocol
	          || !root.ActiveXObject)) {
	    return new XMLHttpRequest;
	  } else {
	    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
	  }
	  throw Error("Browser-only verison of superagent could not find XHR");
	};
	
	/**
	 * Removes leading and trailing whitespace, added to support IE.
	 *
	 * @param {String} s
	 * @return {String}
	 * @api private
	 */
	
	var trim = ''.trim
	  ? function(s) { return s.trim(); }
	  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };
	
	/**
	 * Serialize the given `obj`.
	 *
	 * @param {Object} obj
	 * @return {String}
	 * @api private
	 */
	
	function serialize(obj) {
	  if (!isObject(obj)) return obj;
	  var pairs = [];
	  for (var key in obj) {
	    pushEncodedKeyValuePair(pairs, key, obj[key]);
	  }
	  return pairs.join('&');
	}
	
	/**
	 * Helps 'serialize' with serializing arrays.
	 * Mutates the pairs array.
	 *
	 * @param {Array} pairs
	 * @param {String} key
	 * @param {Mixed} val
	 */
	
	function pushEncodedKeyValuePair(pairs, key, val) {
	  if (val != null) {
	    if (Array.isArray(val)) {
	      val.forEach(function(v) {
	        pushEncodedKeyValuePair(pairs, key, v);
	      });
	    } else if (isObject(val)) {
	      for(var subkey in val) {
	        pushEncodedKeyValuePair(pairs, key + '[' + subkey + ']', val[subkey]);
	      }
	    } else {
	      pairs.push(encodeURIComponent(key)
	        + '=' + encodeURIComponent(val));
	    }
	  } else if (val === null) {
	    pairs.push(encodeURIComponent(key));
	  }
	}
	
	/**
	 * Expose serialization method.
	 */
	
	 request.serializeObject = serialize;
	
	 /**
	  * Parse the given x-www-form-urlencoded `str`.
	  *
	  * @param {String} str
	  * @return {Object}
	  * @api private
	  */
	
	function parseString(str) {
	  var obj = {};
	  var pairs = str.split('&');
	  var pair;
	  var pos;
	
	  for (var i = 0, len = pairs.length; i < len; ++i) {
	    pair = pairs[i];
	    pos = pair.indexOf('=');
	    if (pos == -1) {
	      obj[decodeURIComponent(pair)] = '';
	    } else {
	      obj[decodeURIComponent(pair.slice(0, pos))] =
	        decodeURIComponent(pair.slice(pos + 1));
	    }
	  }
	
	  return obj;
	}
	
	/**
	 * Expose parser.
	 */
	
	request.parseString = parseString;
	
	/**
	 * Default MIME type map.
	 *
	 *     superagent.types.xml = 'application/xml';
	 *
	 */
	
	request.types = {
	  html: 'text/html',
	  json: 'application/json',
	  xml: 'application/xml',
	  urlencoded: 'application/x-www-form-urlencoded',
	  'form': 'application/x-www-form-urlencoded',
	  'form-data': 'application/x-www-form-urlencoded'
	};
	
	/**
	 * Default serialization map.
	 *
	 *     superagent.serialize['application/xml'] = function(obj){
	 *       return 'generated xml here';
	 *     };
	 *
	 */
	
	 request.serialize = {
	   'application/x-www-form-urlencoded': serialize,
	   'application/json': JSON.stringify
	 };
	
	 /**
	  * Default parsers.
	  *
	  *     superagent.parse['application/xml'] = function(str){
	  *       return { object parsed from str };
	  *     };
	  *
	  */
	
	request.parse = {
	  'application/x-www-form-urlencoded': parseString,
	  'application/json': JSON.parse
	};
	
	/**
	 * Parse the given header `str` into
	 * an object containing the mapped fields.
	 *
	 * @param {String} str
	 * @return {Object}
	 * @api private
	 */
	
	function parseHeader(str) {
	  var lines = str.split(/\r?\n/);
	  var fields = {};
	  var index;
	  var line;
	  var field;
	  var val;
	
	  lines.pop(); // trailing CRLF
	
	  for (var i = 0, len = lines.length; i < len; ++i) {
	    line = lines[i];
	    index = line.indexOf(':');
	    field = line.slice(0, index).toLowerCase();
	    val = trim(line.slice(index + 1));
	    fields[field] = val;
	  }
	
	  return fields;
	}
	
	/**
	 * Check if `mime` is json or has +json structured syntax suffix.
	 *
	 * @param {String} mime
	 * @return {Boolean}
	 * @api private
	 */
	
	function isJSON(mime) {
	  return /[\/+]json\b/.test(mime);
	}
	
	/**
	 * Initialize a new `Response` with the given `xhr`.
	 *
	 *  - set flags (.ok, .error, etc)
	 *  - parse header
	 *
	 * Examples:
	 *
	 *  Aliasing `superagent` as `request` is nice:
	 *
	 *      request = superagent;
	 *
	 *  We can use the promise-like API, or pass callbacks:
	 *
	 *      request.get('/').end(function(res){});
	 *      request.get('/', function(res){});
	 *
	 *  Sending data can be chained:
	 *
	 *      request
	 *        .post('/user')
	 *        .send({ name: 'tj' })
	 *        .end(function(res){});
	 *
	 *  Or passed to `.send()`:
	 *
	 *      request
	 *        .post('/user')
	 *        .send({ name: 'tj' }, function(res){});
	 *
	 *  Or passed to `.post()`:
	 *
	 *      request
	 *        .post('/user', { name: 'tj' })
	 *        .end(function(res){});
	 *
	 * Or further reduced to a single call for simple cases:
	 *
	 *      request
	 *        .post('/user', { name: 'tj' }, function(res){});
	 *
	 * @param {XMLHTTPRequest} xhr
	 * @param {Object} options
	 * @api private
	 */
	
	function Response(req) {
	  this.req = req;
	  this.xhr = this.req.xhr;
	  // responseText is accessible only if responseType is '' or 'text' and on older browsers
	  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
	     ? this.xhr.responseText
	     : null;
	  this.statusText = this.req.xhr.statusText;
	  var status = this.xhr.status;
	  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
	  if (status === 1223) {
	      status = 204;
	  }
	  this._setStatusProperties(status);
	  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
	  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
	  // getResponseHeader still works. so we get content-type even if getting
	  // other headers fails.
	  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
	  this._setHeaderProperties(this.header);
	
	  if (null === this.text && req._responseType) {
	    this.body = this.xhr.response;
	  } else {
	    this.body = this.req.method != 'HEAD'
	      ? this._parseBody(this.text ? this.text : this.xhr.response)
	      : null;
	  }
	}
	
	ResponseBase(Response.prototype);
	
	/**
	 * Parse the given body `str`.
	 *
	 * Used for auto-parsing of bodies. Parsers
	 * are defined on the `superagent.parse` object.
	 *
	 * @param {String} str
	 * @return {Mixed}
	 * @api private
	 */
	
	Response.prototype._parseBody = function(str){
	  var parse = request.parse[this.type];
	  if(this.req._parser) {
	    return this.req._parser(this, str);
	  }
	  if (!parse && isJSON(this.type)) {
	    parse = request.parse['application/json'];
	  }
	  return parse && str && (str.length || str instanceof Object)
	    ? parse(str)
	    : null;
	};
	
	/**
	 * Return an `Error` representative of this response.
	 *
	 * @return {Error}
	 * @api public
	 */
	
	Response.prototype.toError = function(){
	  var req = this.req;
	  var method = req.method;
	  var url = req.url;
	
	  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
	  var err = new Error(msg);
	  err.status = this.status;
	  err.method = method;
	  err.url = url;
	
	  return err;
	};
	
	/**
	 * Expose `Response`.
	 */
	
	request.Response = Response;
	
	/**
	 * Initialize a new `Request` with the given `method` and `url`.
	 *
	 * @param {String} method
	 * @param {String} url
	 * @api public
	 */
	
	function Request(method, url) {
	  var self = this;
	  this._query = this._query || [];
	  this.method = method;
	  this.url = url;
	  this.header = {}; // preserves header name case
	  this._header = {}; // coerces header names to lowercase
	  this.on('end', function(){
	    var err = null;
	    var res = null;
	
	    try {
	      res = new Response(self);
	    } catch(e) {
	      err = new Error('Parser is unable to parse the response');
	      err.parse = true;
	      err.original = e;
	      // issue #675: return the raw response if the response parsing fails
	      if (self.xhr) {
	        // ie9 doesn't have 'response' property
	        err.rawResponse = typeof self.xhr.responseType == 'undefined' ? self.xhr.responseText : self.xhr.response;
	        // issue #876: return the http status code if the response parsing fails
	        err.status = self.xhr.status ? self.xhr.status : null;
	        err.statusCode = err.status; // backwards-compat only
	      } else {
	        err.rawResponse = null;
	        err.status = null;
	      }
	
	      return self.callback(err);
	    }
	
	    self.emit('response', res);
	
	    var new_err;
	    try {
	      if (!self._isResponseOK(res)) {
	        new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
	        new_err.original = err;
	        new_err.response = res;
	        new_err.status = res.status;
	      }
	    } catch(e) {
	      new_err = e; // #985 touching res may cause INVALID_STATE_ERR on old Android
	    }
	
	    // #1000 don't catch errors from the callback to avoid double calling it
	    if (new_err) {
	      self.callback(new_err, res);
	    } else {
	      self.callback(null, res);
	    }
	  });
	}
	
	/**
	 * Mixin `Emitter` and `RequestBase`.
	 */
	
	Emitter(Request.prototype);
	RequestBase(Request.prototype);
	
	/**
	 * Set Content-Type to `type`, mapping values from `request.types`.
	 *
	 * Examples:
	 *
	 *      superagent.types.xml = 'application/xml';
	 *
	 *      request.post('/')
	 *        .type('xml')
	 *        .send(xmlstring)
	 *        .end(callback);
	 *
	 *      request.post('/')
	 *        .type('application/xml')
	 *        .send(xmlstring)
	 *        .end(callback);
	 *
	 * @param {String} type
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.type = function(type){
	  this.set('Content-Type', request.types[type] || type);
	  return this;
	};
	
	/**
	 * Set Accept to `type`, mapping values from `request.types`.
	 *
	 * Examples:
	 *
	 *      superagent.types.json = 'application/json';
	 *
	 *      request.get('/agent')
	 *        .accept('json')
	 *        .end(callback);
	 *
	 *      request.get('/agent')
	 *        .accept('application/json')
	 *        .end(callback);
	 *
	 * @param {String} accept
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.accept = function(type){
	  this.set('Accept', request.types[type] || type);
	  return this;
	};
	
	/**
	 * Set Authorization field value with `user` and `pass`.
	 *
	 * @param {String} user
	 * @param {String} [pass] optional in case of using 'bearer' as type
	 * @param {Object} options with 'type' property 'auto', 'basic' or 'bearer' (default 'basic')
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.auth = function(user, pass, options){
	  if (typeof pass === 'object' && pass !== null) { // pass is optional and can substitute for options
	    options = pass;
	  }
	  if (!options) {
	    options = {
	      type: 'function' === typeof btoa ? 'basic' : 'auto',
	    }
	  }
	
	  switch (options.type) {
	    case 'basic':
	      this.set('Authorization', 'Basic ' + btoa(user + ':' + pass));
	    break;
	
	    case 'auto':
	      this.username = user;
	      this.password = pass;
	    break;
	      
	    case 'bearer': // usage would be .auth(accessToken, { type: 'bearer' })
	      this.set('Authorization', 'Bearer ' + user);
	    break;  
	  }
	  return this;
	};
	
	/**
	 * Add query-string `val`.
	 *
	 * Examples:
	 *
	 *   request.get('/shoes')
	 *     .query('size=10')
	 *     .query({ color: 'blue' })
	 *
	 * @param {Object|String} val
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.query = function(val){
	  if ('string' != typeof val) val = serialize(val);
	  if (val) this._query.push(val);
	  return this;
	};
	
	/**
	 * Queue the given `file` as an attachment to the specified `field`,
	 * with optional `options` (or filename).
	 *
	 * ``` js
	 * request.post('/upload')
	 *   .attach('content', new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
	 *   .end(callback);
	 * ```
	 *
	 * @param {String} field
	 * @param {Blob|File} file
	 * @param {String|Object} options
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.attach = function(field, file, options){
	  if (file) {
	    if (this._data) {
	      throw Error("superagent can't mix .send() and .attach()");
	    }
	
	    this._getFormData().append(field, file, options || file.name);
	  }
	  return this;
	};
	
	Request.prototype._getFormData = function(){
	  if (!this._formData) {
	    this._formData = new root.FormData();
	  }
	  return this._formData;
	};
	
	/**
	 * Invoke the callback with `err` and `res`
	 * and handle arity check.
	 *
	 * @param {Error} err
	 * @param {Response} res
	 * @api private
	 */
	
	Request.prototype.callback = function(err, res){
	  // console.log(this._retries, this._maxRetries)
	  if (this._maxRetries && this._retries++ < this._maxRetries && shouldRetry(err, res)) {
	    return this._retry();
	  }
	
	  var fn = this._callback;
	  this.clearTimeout();
	
	  if (err) {
	    if (this._maxRetries) err.retries = this._retries - 1;
	    this.emit('error', err);
	  }
	
	  fn(err, res);
	};
	
	/**
	 * Invoke callback with x-domain error.
	 *
	 * @api private
	 */
	
	Request.prototype.crossDomainError = function(){
	  var err = new Error('Request has been terminated\nPossible causes: the network is offline, Origin is not allowed by Access-Control-Allow-Origin, the page is being unloaded, etc.');
	  err.crossDomain = true;
	
	  err.status = this.status;
	  err.method = this.method;
	  err.url = this.url;
	
	  this.callback(err);
	};
	
	// This only warns, because the request is still likely to work
	Request.prototype.buffer = Request.prototype.ca = Request.prototype.agent = function(){
	  console.warn("This is not supported in browser version of superagent");
	  return this;
	};
	
	// This throws, because it can't send/receive data as expected
	Request.prototype.pipe = Request.prototype.write = function(){
	  throw Error("Streaming is not supported in browser version of superagent");
	};
	
	/**
	 * Compose querystring to append to req.url
	 *
	 * @api private
	 */
	
	Request.prototype._appendQueryString = function(){
	  var query = this._query.join('&');
	  if (query) {
	    this.url += (this.url.indexOf('?') >= 0 ? '&' : '?') + query;
	  }
	
	  if (this._sort) {
	    var index = this.url.indexOf('?');
	    if (index >= 0) {
	      var queryArr = this.url.substring(index + 1).split('&');
	      if (isFunction(this._sort)) {
	        queryArr.sort(this._sort);
	      } else {
	        queryArr.sort();
	      }
	      this.url = this.url.substring(0, index) + '?' + queryArr.join('&');
	    }
	  }
	};
	
	/**
	 * Check if `obj` is a host object,
	 * we don't want to serialize these :)
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */
	Request.prototype._isHost = function _isHost(obj) {
	  // Native objects stringify to [object File], [object Blob], [object FormData], etc.
	  return obj && 'object' === typeof obj && !Array.isArray(obj) && Object.prototype.toString.call(obj) !== '[object Object]';
	}
	
	/**
	 * Initiate request, invoking callback `fn(res)`
	 * with an instanceof `Response`.
	 *
	 * @param {Function} fn
	 * @return {Request} for chaining
	 * @api public
	 */
	
	Request.prototype.end = function(fn){
	  if (this._endCalled) {
	    console.warn("Warning: .end() was called twice. This is not supported in superagent");
	  }
	  this._endCalled = true;
	
	  // store callback
	  this._callback = fn || noop;
	
	  // querystring
	  this._appendQueryString();
	
	  return this._end();
	};
	
	Request.prototype._end = function() {
	  var self = this;
	  var xhr = this.xhr = request.getXHR();
	  var data = this._formData || this._data;
	
	  this._setTimeouts();
	
	  // state change
	  xhr.onreadystatechange = function(){
	    var readyState = xhr.readyState;
	    if (readyState >= 2 && self._responseTimeoutTimer) {
	      clearTimeout(self._responseTimeoutTimer);
	    }
	    if (4 != readyState) {
	      return;
	    }
	
	    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
	    // result in the error "Could not complete the operation due to error c00c023f"
	    var status;
	    try { status = xhr.status } catch(e) { status = 0; }
	
	    if (!status) {
	      if (self.timedout || self._aborted) return;
	      return self.crossDomainError();
	    }
	    self.emit('end');
	  };
	
	  // progress
	  var handleProgress = function(direction, e) {
	    if (e.total > 0) {
	      e.percent = e.loaded / e.total * 100;
	    }
	    e.direction = direction;
	    self.emit('progress', e);
	  }
	  if (this.hasListeners('progress')) {
	    try {
	      xhr.onprogress = handleProgress.bind(null, 'download');
	      if (xhr.upload) {
	        xhr.upload.onprogress = handleProgress.bind(null, 'upload');
	      }
	    } catch(e) {
	      // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
	      // Reported here:
	      // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
	    }
	  }
	
	  // initiate request
	  try {
	    if (this.username && this.password) {
	      xhr.open(this.method, this.url, true, this.username, this.password);
	    } else {
	      xhr.open(this.method, this.url, true);
	    }
	  } catch (err) {
	    // see #1149
	    return this.callback(err);
	  }
	
	  // CORS
	  if (this._withCredentials) xhr.withCredentials = true;
	
	  // body
	  if (!this._formData && 'GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !this._isHost(data)) {
	    // serialize stuff
	    var contentType = this._header['content-type'];
	    var serialize = this._serializer || request.serialize[contentType ? contentType.split(';')[0] : ''];
	    if (!serialize && isJSON(contentType)) {
	      serialize = request.serialize['application/json'];
	    }
	    if (serialize) data = serialize(data);
	  }
	
	  // set header fields
	  for (var field in this.header) {
	    if (null == this.header[field]) continue;
	
	    if (this.header.hasOwnProperty(field))
	      xhr.setRequestHeader(field, this.header[field]);
	  }
	
	  if (this._responseType) {
	    xhr.responseType = this._responseType;
	  }
	
	  // send stuff
	  this.emit('request', this);
	
	  // IE11 xhr.send(undefined) sends 'undefined' string as POST payload (instead of nothing)
	  // We need null here if data is undefined
	  xhr.send(typeof data !== 'undefined' ? data : null);
	  return this;
	};
	
	/**
	 * GET `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} [data] or fn
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.get = function(url, data, fn){
	  var req = request('GET', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.query(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	/**
	 * HEAD `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} [data] or fn
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.head = function(url, data, fn){
	  var req = request('HEAD', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	/**
	 * OPTIONS query to `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} [data] or fn
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.options = function(url, data, fn){
	  var req = request('OPTIONS', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	/**
	 * DELETE `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed} [data]
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	function del(url, data, fn){
	  var req = request('DELETE', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	request['del'] = del;
	request['delete'] = del;
	
	/**
	 * PATCH `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed} [data]
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.patch = function(url, data, fn){
	  var req = request('PATCH', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	/**
	 * POST `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed} [data]
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.post = function(url, data, fn){
	  var req = request('POST', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};
	
	/**
	 * PUT `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} [data] or fn
	 * @param {Function} [fn]
	 * @return {Request}
	 * @api public
	 */
	
	request.put = function(url, data, fn){
	  var req = request('PUT', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `Emitter`.
	 */
	
	if (true) {
	  module.exports = Emitter;
	}
	
	/**
	 * Initialize a new `Emitter`.
	 *
	 * @api public
	 */
	
	function Emitter(obj) {
	  if (obj) return mixin(obj);
	};
	
	/**
	 * Mixin the emitter properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */
	
	function mixin(obj) {
	  for (var key in Emitter.prototype) {
	    obj[key] = Emitter.prototype[key];
	  }
	  return obj;
	}
	
	/**
	 * Listen on the given `event` with `fn`.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.on =
	Emitter.prototype.addEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
	    .push(fn);
	  return this;
	};
	
	/**
	 * Adds an `event` listener that will be invoked a single
	 * time then automatically removed.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.once = function(event, fn){
	  function on() {
	    this.off(event, on);
	    fn.apply(this, arguments);
	  }
	
	  on.fn = fn;
	  this.on(event, on);
	  return this;
	};
	
	/**
	 * Remove the given callback for `event` or all
	 * registered callbacks.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.off =
	Emitter.prototype.removeListener =
	Emitter.prototype.removeAllListeners =
	Emitter.prototype.removeEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	
	  // all
	  if (0 == arguments.length) {
	    this._callbacks = {};
	    return this;
	  }
	
	  // specific event
	  var callbacks = this._callbacks['$' + event];
	  if (!callbacks) return this;
	
	  // remove all handlers
	  if (1 == arguments.length) {
	    delete this._callbacks['$' + event];
	    return this;
	  }
	
	  // remove specific handler
	  var cb;
	  for (var i = 0; i < callbacks.length; i++) {
	    cb = callbacks[i];
	    if (cb === fn || cb.fn === fn) {
	      callbacks.splice(i, 1);
	      break;
	    }
	  }
	  return this;
	};
	
	/**
	 * Emit `event` with the given args.
	 *
	 * @param {String} event
	 * @param {Mixed} ...
	 * @return {Emitter}
	 */
	
	Emitter.prototype.emit = function(event){
	  this._callbacks = this._callbacks || {};
	  var args = [].slice.call(arguments, 1)
	    , callbacks = this._callbacks['$' + event];
	
	  if (callbacks) {
	    callbacks = callbacks.slice(0);
	    for (var i = 0, len = callbacks.length; i < len; ++i) {
	      callbacks[i].apply(this, args);
	    }
	  }
	
	  return this;
	};
	
	/**
	 * Return array of callbacks for `event`.
	 *
	 * @param {String} event
	 * @return {Array}
	 * @api public
	 */
	
	Emitter.prototype.listeners = function(event){
	  this._callbacks = this._callbacks || {};
	  return this._callbacks['$' + event] || [];
	};
	
	/**
	 * Check if this emitter has `event` handlers.
	 *
	 * @param {String} event
	 * @return {Boolean}
	 * @api public
	 */
	
	Emitter.prototype.hasListeners = function(event){
	  return !! this.listeners(event).length;
	};


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Module of mixed-in functions shared between node and client code
	 */
	var isObject = __webpack_require__(34);
	
	/**
	 * Expose `RequestBase`.
	 */
	
	module.exports = RequestBase;
	
	/**
	 * Initialize a new `RequestBase`.
	 *
	 * @api public
	 */
	
	function RequestBase(obj) {
	  if (obj) return mixin(obj);
	}
	
	/**
	 * Mixin the prototype properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */
	
	function mixin(obj) {
	  for (var key in RequestBase.prototype) {
	    obj[key] = RequestBase.prototype[key];
	  }
	  return obj;
	}
	
	/**
	 * Clear previous timeout.
	 *
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.clearTimeout = function _clearTimeout(){
	  clearTimeout(this._timer);
	  clearTimeout(this._responseTimeoutTimer);
	  delete this._timer;
	  delete this._responseTimeoutTimer;
	  return this;
	};
	
	/**
	 * Override default response body parser
	 *
	 * This function will be called to convert incoming data into request.body
	 *
	 * @param {Function}
	 * @api public
	 */
	
	RequestBase.prototype.parse = function parse(fn){
	  this._parser = fn;
	  return this;
	};
	
	/**
	 * Set format of binary response body.
	 * In browser valid formats are 'blob' and 'arraybuffer',
	 * which return Blob and ArrayBuffer, respectively.
	 *
	 * In Node all values result in Buffer.
	 *
	 * Examples:
	 *
	 *      req.get('/')
	 *        .responseType('blob')
	 *        .end(callback);
	 *
	 * @param {String} val
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.responseType = function(val){
	  this._responseType = val;
	  return this;
	};
	
	/**
	 * Override default request body serializer
	 *
	 * This function will be called to convert data set via .send or .attach into payload to send
	 *
	 * @param {Function}
	 * @api public
	 */
	
	RequestBase.prototype.serialize = function serialize(fn){
	  this._serializer = fn;
	  return this;
	};
	
	/**
	 * Set timeouts.
	 *
	 * - response timeout is time between sending request and receiving the first byte of the response. Includes DNS and connection time.
	 * - deadline is the time from start of the request to receiving response body in full. If the deadline is too short large files may not load at all on slow connections.
	 *
	 * Value of 0 or false means no timeout.
	 *
	 * @param {Number|Object} ms or {response, read, deadline}
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.timeout = function timeout(options){
	  if (!options || 'object' !== typeof options) {
	    this._timeout = options;
	    this._responseTimeout = 0;
	    return this;
	  }
	
	  for(var option in options) {
	    switch(option) {
	      case 'deadline':
	        this._timeout = options.deadline;
	        break;
	      case 'response':
	        this._responseTimeout = options.response;
	        break;
	      default:
	        console.warn("Unknown timeout option", option);
	    }
	  }
	  return this;
	};
	
	/**
	 * Set number of retry attempts on error.
	 *
	 * Failed requests will be retried 'count' times if timeout or err.code >= 500.
	 *
	 * @param {Number} count
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.retry = function retry(count){
	  // Default to 1 if no count passed or true
	  if (arguments.length === 0 || count === true) count = 1;
	  if (count <= 0) count = 0;
	  this._maxRetries = count;
	  this._retries = 0;
	  return this;
	};
	
	/**
	 * Retry request
	 *
	 * @return {Request} for chaining
	 * @api private
	 */
	
	RequestBase.prototype._retry = function() {
	  this.clearTimeout();
	
	  // node
	  if (this.req) {
	    this.req = null;
	    this.req = this.request();
	  }
	
	  this._aborted = false;
	  this.timedout = false;
	
	  return this._end();
	};
	
	/**
	 * Promise support
	 *
	 * @param {Function} resolve
	 * @param {Function} [reject]
	 * @return {Request}
	 */
	
	RequestBase.prototype.then = function then(resolve, reject) {
	  if (!this._fullfilledPromise) {
	    var self = this;
	    if (this._endCalled) {
	      console.warn("Warning: superagent request was sent twice, because both .end() and .then() were called. Never call .end() if you use promises");
	    }
	    this._fullfilledPromise = new Promise(function(innerResolve, innerReject){
	      self.end(function(err, res){
	        if (err) innerReject(err); else innerResolve(res);
	      });
	    });
	  }
	  return this._fullfilledPromise.then(resolve, reject);
	}
	
	RequestBase.prototype.catch = function(cb) {
	  return this.then(undefined, cb);
	};
	
	/**
	 * Allow for extension
	 */
	
	RequestBase.prototype.use = function use(fn) {
	  fn(this);
	  return this;
	}
	
	RequestBase.prototype.ok = function(cb) {
	  if ('function' !== typeof cb) throw Error("Callback required");
	  this._okCallback = cb;
	  return this;
	};
	
	RequestBase.prototype._isResponseOK = function(res) {
	  if (!res) {
	    return false;
	  }
	
	  if (this._okCallback) {
	    return this._okCallback(res);
	  }
	
	  return res.status >= 200 && res.status < 300;
	};
	
	
	/**
	 * Get request header `field`.
	 * Case-insensitive.
	 *
	 * @param {String} field
	 * @return {String}
	 * @api public
	 */
	
	RequestBase.prototype.get = function(field){
	  return this._header[field.toLowerCase()];
	};
	
	/**
	 * Get case-insensitive header `field` value.
	 * This is a deprecated internal API. Use `.get(field)` instead.
	 *
	 * (getHeader is no longer used internally by the superagent code base)
	 *
	 * @param {String} field
	 * @return {String}
	 * @api private
	 * @deprecated
	 */
	
	RequestBase.prototype.getHeader = RequestBase.prototype.get;
	
	/**
	 * Set header `field` to `val`, or multiple fields with one object.
	 * Case-insensitive.
	 *
	 * Examples:
	 *
	 *      req.get('/')
	 *        .set('Accept', 'application/json')
	 *        .set('X-API-Key', 'foobar')
	 *        .end(callback);
	 *
	 *      req.get('/')
	 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
	 *        .end(callback);
	 *
	 * @param {String|Object} field
	 * @param {String} val
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.set = function(field, val){
	  if (isObject(field)) {
	    for (var key in field) {
	      this.set(key, field[key]);
	    }
	    return this;
	  }
	  this._header[field.toLowerCase()] = val;
	  this.header[field] = val;
	  return this;
	};
	
	/**
	 * Remove header `field`.
	 * Case-insensitive.
	 *
	 * Example:
	 *
	 *      req.get('/')
	 *        .unset('User-Agent')
	 *        .end(callback);
	 *
	 * @param {String} field
	 */
	RequestBase.prototype.unset = function(field){
	  delete this._header[field.toLowerCase()];
	  delete this.header[field];
	  return this;
	};
	
	/**
	 * Write the field `name` and `val`, or multiple fields with one object
	 * for "multipart/form-data" request bodies.
	 *
	 * ``` js
	 * request.post('/upload')
	 *   .field('foo', 'bar')
	 *   .end(callback);
	 *
	 * request.post('/upload')
	 *   .field({ foo: 'bar', baz: 'qux' })
	 *   .end(callback);
	 * ```
	 *
	 * @param {String|Object} name
	 * @param {String|Blob|File|Buffer|fs.ReadStream} val
	 * @return {Request} for chaining
	 * @api public
	 */
	RequestBase.prototype.field = function(name, val) {
	
	  // name should be either a string or an object.
	  if (null === name ||  undefined === name) {
	    throw new Error('.field(name, val) name can not be empty');
	  }
	
	  if (this._data) {
	    console.error(".field() can't be used if .send() is used. Please use only .send() or only .field() & .attach()");
	  }
	
	  if (isObject(name)) {
	    for (var key in name) {
	      this.field(key, name[key]);
	    }
	    return this;
	  }
	
	  if (Array.isArray(val)) {
	    for (var i in val) {
	      this.field(name, val[i]);
	    }
	    return this;
	  }
	
	  // val should be defined now
	  if (null === val || undefined === val) {
	    throw new Error('.field(name, val) val can not be empty');
	  }
	  if ('boolean' === typeof val) {
	    val = '' + val;
	  }
	  this._getFormData().append(name, val);
	  return this;
	};
	
	/**
	 * Abort the request, and clear potential timeout.
	 *
	 * @return {Request}
	 * @api public
	 */
	RequestBase.prototype.abort = function(){
	  if (this._aborted) {
	    return this;
	  }
	  this._aborted = true;
	  this.xhr && this.xhr.abort(); // browser
	  this.req && this.req.abort(); // node
	  this.clearTimeout();
	  this.emit('abort');
	  return this;
	};
	
	/**
	 * Enable transmission of cookies with x-domain requests.
	 *
	 * Note that for this to work the origin must not be
	 * using "Access-Control-Allow-Origin" with a wildcard,
	 * and also must set "Access-Control-Allow-Credentials"
	 * to "true".
	 *
	 * @api public
	 */
	
	RequestBase.prototype.withCredentials = function(on){
	  // This is browser-only functionality. Node side is no-op.
	  if(on==undefined) on = true;
	  this._withCredentials = on;
	  return this;
	};
	
	/**
	 * Set the max redirects to `n`. Does noting in browser XHR implementation.
	 *
	 * @param {Number} n
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.redirects = function(n){
	  this._maxRedirects = n;
	  return this;
	};
	
	/**
	 * Convert to a plain javascript object (not JSON string) of scalar properties.
	 * Note as this method is designed to return a useful non-this value,
	 * it cannot be chained.
	 *
	 * @return {Object} describing method, url, and data of this request
	 * @api public
	 */
	
	RequestBase.prototype.toJSON = function(){
	  return {
	    method: this.method,
	    url: this.url,
	    data: this._data,
	    headers: this._header
	  };
	};
	
	
	/**
	 * Send `data` as the request body, defaulting the `.type()` to "json" when
	 * an object is given.
	 *
	 * Examples:
	 *
	 *       // manual json
	 *       request.post('/user')
	 *         .type('json')
	 *         .send('{"name":"tj"}')
	 *         .end(callback)
	 *
	 *       // auto json
	 *       request.post('/user')
	 *         .send({ name: 'tj' })
	 *         .end(callback)
	 *
	 *       // manual x-www-form-urlencoded
	 *       request.post('/user')
	 *         .type('form')
	 *         .send('name=tj')
	 *         .end(callback)
	 *
	 *       // auto x-www-form-urlencoded
	 *       request.post('/user')
	 *         .type('form')
	 *         .send({ name: 'tj' })
	 *         .end(callback)
	 *
	 *       // defaults to x-www-form-urlencoded
	 *      request.post('/user')
	 *        .send('name=tobi')
	 *        .send('species=ferret')
	 *        .end(callback)
	 *
	 * @param {String|Object} data
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.send = function(data){
	  var isObj = isObject(data);
	  var type = this._header['content-type'];
	
	  if (this._formData) {
	    console.error(".send() can't be used if .attach() or .field() is used. Please use only .send() or only .field() & .attach()");
	  }
	
	  if (isObj && !this._data) {
	    if (Array.isArray(data)) {
	      this._data = [];
	    } else if (!this._isHost(data)) {
	      this._data = {};
	    }
	  } else if (data && this._data && this._isHost(this._data)) {
	    throw Error("Can't merge these send calls");
	  }
	
	  // merge
	  if (isObj && isObject(this._data)) {
	    for (var key in data) {
	      this._data[key] = data[key];
	    }
	  } else if ('string' == typeof data) {
	    // default to x-www-form-urlencoded
	    if (!type) this.type('form');
	    type = this._header['content-type'];
	    if ('application/x-www-form-urlencoded' == type) {
	      this._data = this._data
	        ? this._data + '&' + data
	        : data;
	    } else {
	      this._data = (this._data || '') + data;
	    }
	  } else {
	    this._data = data;
	  }
	
	  if (!isObj || this._isHost(data)) {
	    return this;
	  }
	
	  // default to json
	  if (!type) this.type('json');
	  return this;
	};
	
	
	/**
	 * Sort `querystring` by the sort function
	 *
	 *
	 * Examples:
	 *
	 *       // default order
	 *       request.get('/user')
	 *         .query('name=Nick')
	 *         .query('search=Manny')
	 *         .sortQuery()
	 *         .end(callback)
	 *
	 *       // customized sort function
	 *       request.get('/user')
	 *         .query('name=Nick')
	 *         .query('search=Manny')
	 *         .sortQuery(function(a, b){
	 *           return a.length - b.length;
	 *         })
	 *         .end(callback)
	 *
	 *
	 * @param {Function} sort
	 * @return {Request} for chaining
	 * @api public
	 */
	
	RequestBase.prototype.sortQuery = function(sort) {
	  // _sort default to true but otherwise can be a function or boolean
	  this._sort = typeof sort === 'undefined' ? true : sort;
	  return this;
	};
	
	/**
	 * Invoke callback with timeout error.
	 *
	 * @api private
	 */
	
	RequestBase.prototype._timeoutError = function(reason, timeout, errno){
	  if (this._aborted) {
	    return;
	  }
	  var err = new Error(reason + timeout + 'ms exceeded');
	  err.timeout = timeout;
	  err.code = 'ECONNABORTED';
	  err.errno = errno;
	  this.timedout = true;
	  this.abort();
	  this.callback(err);
	};
	
	RequestBase.prototype._setTimeouts = function() {
	  var self = this;
	
	  // deadline
	  if (this._timeout && !this._timer) {
	    this._timer = setTimeout(function(){
	      self._timeoutError('Timeout of ', self._timeout, 'ETIME');
	    }, this._timeout);
	  }
	  // response timeout
	  if (this._responseTimeout && !this._responseTimeoutTimer) {
	    this._responseTimeoutTimer = setTimeout(function(){
	      self._timeoutError('Response timeout of ', self._responseTimeout, 'ETIMEDOUT');
	    }, this._responseTimeout);
	  }
	}


/***/ }),
/* 34 */
/***/ (function(module, exports) {

	/**
	 * Check if `obj` is an object.
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */
	
	function isObject(obj) {
	  return null !== obj && 'object' === typeof obj;
	}
	
	module.exports = isObject;


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Check if `fn` is a function.
	 *
	 * @param {Function} fn
	 * @return {Boolean}
	 * @api private
	 */
	var isObject = __webpack_require__(34);
	
	function isFunction(fn) {
	  var tag = isObject(fn) ? Object.prototype.toString.call(fn) : '';
	  return tag === '[object Function]';
	}
	
	module.exports = isFunction;


/***/ }),
/* 36 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */
	
	var utils = __webpack_require__(37);
	
	/**
	 * Expose `ResponseBase`.
	 */
	
	module.exports = ResponseBase;
	
	/**
	 * Initialize a new `ResponseBase`.
	 *
	 * @api public
	 */
	
	function ResponseBase(obj) {
	  if (obj) return mixin(obj);
	}
	
	/**
	 * Mixin the prototype properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */
	
	function mixin(obj) {
	  for (var key in ResponseBase.prototype) {
	    obj[key] = ResponseBase.prototype[key];
	  }
	  return obj;
	}
	
	/**
	 * Get case-insensitive `field` value.
	 *
	 * @param {String} field
	 * @return {String}
	 * @api public
	 */
	
	ResponseBase.prototype.get = function(field){
	    return this.header[field.toLowerCase()];
	};
	
	/**
	 * Set header related properties:
	 *
	 *   - `.type` the content type without params
	 *
	 * A response of "Content-Type: text/plain; charset=utf-8"
	 * will provide you with a `.type` of "text/plain".
	 *
	 * @param {Object} header
	 * @api private
	 */
	
	ResponseBase.prototype._setHeaderProperties = function(header){
	    // TODO: moar!
	    // TODO: make this a util
	
	    // content-type
	    var ct = header['content-type'] || '';
	    this.type = utils.type(ct);
	
	    // params
	    var params = utils.params(ct);
	    for (var key in params) this[key] = params[key];
	
	    this.links = {};
	
	    // links
	    try {
	        if (header.link) {
	            this.links = utils.parseLinks(header.link);
	        }
	    } catch (err) {
	        // ignore
	    }
	};
	
	/**
	 * Set flags such as `.ok` based on `status`.
	 *
	 * For example a 2xx response will give you a `.ok` of __true__
	 * whereas 5xx will be __false__ and `.error` will be __true__. The
	 * `.clientError` and `.serverError` are also available to be more
	 * specific, and `.statusType` is the class of error ranging from 1..5
	 * sometimes useful for mapping respond colors etc.
	 *
	 * "sugar" properties are also defined for common cases. Currently providing:
	 *
	 *   - .noContent
	 *   - .badRequest
	 *   - .unauthorized
	 *   - .notAcceptable
	 *   - .notFound
	 *
	 * @param {Number} status
	 * @api private
	 */
	
	ResponseBase.prototype._setStatusProperties = function(status){
	    var type = status / 100 | 0;
	
	    // status / class
	    this.status = this.statusCode = status;
	    this.statusType = type;
	
	    // basics
	    this.info = 1 == type;
	    this.ok = 2 == type;
	    this.redirect = 3 == type;
	    this.clientError = 4 == type;
	    this.serverError = 5 == type;
	    this.error = (4 == type || 5 == type)
	        ? this.toError()
	        : false;
	
	    // sugar
	    this.accepted = 202 == status;
	    this.noContent = 204 == status;
	    this.badRequest = 400 == status;
	    this.unauthorized = 401 == status;
	    this.notAcceptable = 406 == status;
	    this.forbidden = 403 == status;
	    this.notFound = 404 == status;
	};


/***/ }),
/* 37 */
/***/ (function(module, exports) {

	
	/**
	 * Return the mime type for the given `str`.
	 *
	 * @param {String} str
	 * @return {String}
	 * @api private
	 */
	
	exports.type = function(str){
	  return str.split(/ *; */).shift();
	};
	
	/**
	 * Return header field parameters.
	 *
	 * @param {String} str
	 * @return {Object}
	 * @api private
	 */
	
	exports.params = function(str){
	  return str.split(/ *; */).reduce(function(obj, str){
	    var parts = str.split(/ *= */);
	    var key = parts.shift();
	    var val = parts.shift();
	
	    if (key && val) obj[key] = val;
	    return obj;
	  }, {});
	};
	
	/**
	 * Parse Link header fields.
	 *
	 * @param {String} str
	 * @return {Object}
	 * @api private
	 */
	
	exports.parseLinks = function(str){
	  return str.split(/ *, */).reduce(function(obj, str){
	    var parts = str.split(/ *; */);
	    var url = parts[0].slice(1, -1);
	    var rel = parts[1].split(/ *= */)[1].slice(1, -1);
	    obj[rel] = url;
	    return obj;
	  }, {});
	};
	
	/**
	 * Strip content related fields from `header`.
	 *
	 * @param {Object} header
	 * @return {Object} header
	 * @api private
	 */
	
	exports.cleanHeader = function(header, shouldStripCookie){
	  delete header['content-type'];
	  delete header['content-length'];
	  delete header['transfer-encoding'];
	  delete header['host'];
	  if (shouldStripCookie) {
	    delete header['cookie'];
	  }
	  return header;
	};

/***/ }),
/* 38 */
/***/ (function(module, exports) {

	var ERROR_CODES = [
	  'ECONNRESET',
	  'ETIMEDOUT',
	  'EADDRINFO',
	  'ESOCKETTIMEDOUT'
	];
	
	/**
	 * Determine if a request should be retried.
	 * (Borrowed from segmentio/superagent-retry)
	 *
	 * @param {Error} err
	 * @param {Response} [res]
	 * @returns {Boolean}
	 */
	module.exports = function shouldRetry(err, res) {
	  if (err && err.code && ~ERROR_CODES.indexOf(err.code)) return true;
	  if (res && res.status && res.status >= 500) return true;
	  // Superagent timeout
	  if (err && 'timeout' in err && err.code == 'ECONNABORTED') return true;
	  if (err && 'crossDomain' in err) return true;
	  return false;
	};


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var urlUtils = __webpack_require__(40);
	
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


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	
	'use strict';
	
	var punycode = __webpack_require__(41);
	var util = __webpack_require__(43);
	
	exports.parse = urlParse;
	exports.resolve = urlResolve;
	exports.resolveObject = urlResolveObject;
	exports.format = urlFormat;
	
	exports.Url = Url;
	
	function Url() {
	  this.protocol = null;
	  this.slashes = null;
	  this.auth = null;
	  this.host = null;
	  this.port = null;
	  this.hostname = null;
	  this.hash = null;
	  this.search = null;
	  this.query = null;
	  this.pathname = null;
	  this.path = null;
	  this.href = null;
	}
	
	// Reference: RFC 3986, RFC 1808, RFC 2396
	
	// define these here so at least they only have to be
	// compiled once on the first module load.
	var protocolPattern = /^([a-z0-9.+-]+:)/i,
	    portPattern = /:[0-9]*$/,
	
	    // Special case for a simple path URL
	    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
	
	    // RFC 2396: characters reserved for delimiting URLs.
	    // We actually just auto-escape these.
	    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],
	
	    // RFC 2396: characters not allowed for various reasons.
	    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),
	
	    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
	    autoEscape = ['\''].concat(unwise),
	    // Characters that are never ever allowed in a hostname.
	    // Note that any invalid chars are also handled, but these
	    // are the ones that are *expected* to be seen, so we fast-path
	    // them.
	    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
	    hostEndingChars = ['/', '?', '#'],
	    hostnameMaxLen = 255,
	    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
	    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
	    // protocols that can allow "unsafe" and "unwise" chars.
	    unsafeProtocol = {
	      'javascript': true,
	      'javascript:': true
	    },
	    // protocols that never have a hostname.
	    hostlessProtocol = {
	      'javascript': true,
	      'javascript:': true
	    },
	    // protocols that always contain a // bit.
	    slashedProtocol = {
	      'http': true,
	      'https': true,
	      'ftp': true,
	      'gopher': true,
	      'file': true,
	      'http:': true,
	      'https:': true,
	      'ftp:': true,
	      'gopher:': true,
	      'file:': true
	    },
	    querystring = __webpack_require__(44);
	
	function urlParse(url, parseQueryString, slashesDenoteHost) {
	  if (url && util.isObject(url) && url instanceof Url) return url;
	
	  var u = new Url;
	  u.parse(url, parseQueryString, slashesDenoteHost);
	  return u;
	}
	
	Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
	  if (!util.isString(url)) {
	    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
	  }
	
	  // Copy chrome, IE, opera backslash-handling behavior.
	  // Back slashes before the query string get converted to forward slashes
	  // See: https://code.google.com/p/chromium/issues/detail?id=25916
	  var queryIndex = url.indexOf('?'),
	      splitter =
	          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
	      uSplit = url.split(splitter),
	      slashRegex = /\\/g;
	  uSplit[0] = uSplit[0].replace(slashRegex, '/');
	  url = uSplit.join(splitter);
	
	  var rest = url;
	
	  // trim before proceeding.
	  // This is to support parse stuff like "  http://foo.com  \n"
	  rest = rest.trim();
	
	  if (!slashesDenoteHost && url.split('#').length === 1) {
	    // Try fast path regexp
	    var simplePath = simplePathPattern.exec(rest);
	    if (simplePath) {
	      this.path = rest;
	      this.href = rest;
	      this.pathname = simplePath[1];
	      if (simplePath[2]) {
	        this.search = simplePath[2];
	        if (parseQueryString) {
	          this.query = querystring.parse(this.search.substr(1));
	        } else {
	          this.query = this.search.substr(1);
	        }
	      } else if (parseQueryString) {
	        this.search = '';
	        this.query = {};
	      }
	      return this;
	    }
	  }
	
	  var proto = protocolPattern.exec(rest);
	  if (proto) {
	    proto = proto[0];
	    var lowerProto = proto.toLowerCase();
	    this.protocol = lowerProto;
	    rest = rest.substr(proto.length);
	  }
	
	  // figure out if it's got a host
	  // user@server is *always* interpreted as a hostname, and url
	  // resolution will treat //foo/bar as host=foo,path=bar because that's
	  // how the browser resolves relative URLs.
	  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
	    var slashes = rest.substr(0, 2) === '//';
	    if (slashes && !(proto && hostlessProtocol[proto])) {
	      rest = rest.substr(2);
	      this.slashes = true;
	    }
	  }
	
	  if (!hostlessProtocol[proto] &&
	      (slashes || (proto && !slashedProtocol[proto]))) {
	
	    // there's a hostname.
	    // the first instance of /, ?, ;, or # ends the host.
	    //
	    // If there is an @ in the hostname, then non-host chars *are* allowed
	    // to the left of the last @ sign, unless some host-ending character
	    // comes *before* the @-sign.
	    // URLs are obnoxious.
	    //
	    // ex:
	    // http://a@b@c/ => user:a@b host:c
	    // http://a@b?@c => user:a host:c path:/?@c
	
	    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
	    // Review our test case against browsers more comprehensively.
	
	    // find the first instance of any hostEndingChars
	    var hostEnd = -1;
	    for (var i = 0; i < hostEndingChars.length; i++) {
	      var hec = rest.indexOf(hostEndingChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
	        hostEnd = hec;
	    }
	
	    // at this point, either we have an explicit point where the
	    // auth portion cannot go past, or the last @ char is the decider.
	    var auth, atSign;
	    if (hostEnd === -1) {
	      // atSign can be anywhere.
	      atSign = rest.lastIndexOf('@');
	    } else {
	      // atSign must be in auth portion.
	      // http://a@b/c@d => host:b auth:a path:/c@d
	      atSign = rest.lastIndexOf('@', hostEnd);
	    }
	
	    // Now we have a portion which is definitely the auth.
	    // Pull that off.
	    if (atSign !== -1) {
	      auth = rest.slice(0, atSign);
	      rest = rest.slice(atSign + 1);
	      this.auth = decodeURIComponent(auth);
	    }
	
	    // the host is the remaining to the left of the first non-host char
	    hostEnd = -1;
	    for (var i = 0; i < nonHostChars.length; i++) {
	      var hec = rest.indexOf(nonHostChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
	        hostEnd = hec;
	    }
	    // if we still have not hit it, then the entire thing is a host.
	    if (hostEnd === -1)
	      hostEnd = rest.length;
	
	    this.host = rest.slice(0, hostEnd);
	    rest = rest.slice(hostEnd);
	
	    // pull out port.
	    this.parseHost();
	
	    // we've indicated that there is a hostname,
	    // so even if it's empty, it has to be present.
	    this.hostname = this.hostname || '';
	
	    // if hostname begins with [ and ends with ]
	    // assume that it's an IPv6 address.
	    var ipv6Hostname = this.hostname[0] === '[' &&
	        this.hostname[this.hostname.length - 1] === ']';
	
	    // validate a little.
	    if (!ipv6Hostname) {
	      var hostparts = this.hostname.split(/\./);
	      for (var i = 0, l = hostparts.length; i < l; i++) {
	        var part = hostparts[i];
	        if (!part) continue;
	        if (!part.match(hostnamePartPattern)) {
	          var newpart = '';
	          for (var j = 0, k = part.length; j < k; j++) {
	            if (part.charCodeAt(j) > 127) {
	              // we replace non-ASCII char with a temporary placeholder
	              // we need this to make sure size of hostname is not
	              // broken by replacing non-ASCII by nothing
	              newpart += 'x';
	            } else {
	              newpart += part[j];
	            }
	          }
	          // we test again with ASCII char only
	          if (!newpart.match(hostnamePartPattern)) {
	            var validParts = hostparts.slice(0, i);
	            var notHost = hostparts.slice(i + 1);
	            var bit = part.match(hostnamePartStart);
	            if (bit) {
	              validParts.push(bit[1]);
	              notHost.unshift(bit[2]);
	            }
	            if (notHost.length) {
	              rest = '/' + notHost.join('.') + rest;
	            }
	            this.hostname = validParts.join('.');
	            break;
	          }
	        }
	      }
	    }
	
	    if (this.hostname.length > hostnameMaxLen) {
	      this.hostname = '';
	    } else {
	      // hostnames are always lower case.
	      this.hostname = this.hostname.toLowerCase();
	    }
	
	    if (!ipv6Hostname) {
	      // IDNA Support: Returns a punycoded representation of "domain".
	      // It only converts parts of the domain name that
	      // have non-ASCII characters, i.e. it doesn't matter if
	      // you call it with a domain that already is ASCII-only.
	      this.hostname = punycode.toASCII(this.hostname);
	    }
	
	    var p = this.port ? ':' + this.port : '';
	    var h = this.hostname || '';
	    this.host = h + p;
	    this.href += this.host;
	
	    // strip [ and ] from the hostname
	    // the host field still retains them, though
	    if (ipv6Hostname) {
	      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
	      if (rest[0] !== '/') {
	        rest = '/' + rest;
	      }
	    }
	  }
	
	  // now rest is set to the post-host stuff.
	  // chop off any delim chars.
	  if (!unsafeProtocol[lowerProto]) {
	
	    // First, make 100% sure that any "autoEscape" chars get
	    // escaped, even if encodeURIComponent doesn't think they
	    // need to be.
	    for (var i = 0, l = autoEscape.length; i < l; i++) {
	      var ae = autoEscape[i];
	      if (rest.indexOf(ae) === -1)
	        continue;
	      var esc = encodeURIComponent(ae);
	      if (esc === ae) {
	        esc = escape(ae);
	      }
	      rest = rest.split(ae).join(esc);
	    }
	  }
	
	
	  // chop off from the tail first.
	  var hash = rest.indexOf('#');
	  if (hash !== -1) {
	    // got a fragment string.
	    this.hash = rest.substr(hash);
	    rest = rest.slice(0, hash);
	  }
	  var qm = rest.indexOf('?');
	  if (qm !== -1) {
	    this.search = rest.substr(qm);
	    this.query = rest.substr(qm + 1);
	    if (parseQueryString) {
	      this.query = querystring.parse(this.query);
	    }
	    rest = rest.slice(0, qm);
	  } else if (parseQueryString) {
	    // no query string, but parseQueryString still requested
	    this.search = '';
	    this.query = {};
	  }
	  if (rest) this.pathname = rest;
	  if (slashedProtocol[lowerProto] &&
	      this.hostname && !this.pathname) {
	    this.pathname = '/';
	  }
	
	  //to support http.request
	  if (this.pathname || this.search) {
	    var p = this.pathname || '';
	    var s = this.search || '';
	    this.path = p + s;
	  }
	
	  // finally, reconstruct the href based on what has been validated.
	  this.href = this.format();
	  return this;
	};
	
	// format a parsed object into a url string
	function urlFormat(obj) {
	  // ensure it's an object, and not a string url.
	  // If it's an obj, this is a no-op.
	  // this way, you can call url_format() on strings
	  // to clean up potentially wonky urls.
	  if (util.isString(obj)) obj = urlParse(obj);
	  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
	  return obj.format();
	}
	
	Url.prototype.format = function() {
	  var auth = this.auth || '';
	  if (auth) {
	    auth = encodeURIComponent(auth);
	    auth = auth.replace(/%3A/i, ':');
	    auth += '@';
	  }
	
	  var protocol = this.protocol || '',
	      pathname = this.pathname || '',
	      hash = this.hash || '',
	      host = false,
	      query = '';
	
	  if (this.host) {
	    host = auth + this.host;
	  } else if (this.hostname) {
	    host = auth + (this.hostname.indexOf(':') === -1 ?
	        this.hostname :
	        '[' + this.hostname + ']');
	    if (this.port) {
	      host += ':' + this.port;
	    }
	  }
	
	  if (this.query &&
	      util.isObject(this.query) &&
	      Object.keys(this.query).length) {
	    query = querystring.stringify(this.query);
	  }
	
	  var search = this.search || (query && ('?' + query)) || '';
	
	  if (protocol && protocol.substr(-1) !== ':') protocol += ':';
	
	  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
	  // unless they had them to begin with.
	  if (this.slashes ||
	      (!protocol || slashedProtocol[protocol]) && host !== false) {
	    host = '//' + (host || '');
	    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
	  } else if (!host) {
	    host = '';
	  }
	
	  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
	  if (search && search.charAt(0) !== '?') search = '?' + search;
	
	  pathname = pathname.replace(/[?#]/g, function(match) {
	    return encodeURIComponent(match);
	  });
	  search = search.replace('#', '%23');
	
	  return protocol + host + pathname + search + hash;
	};
	
	function urlResolve(source, relative) {
	  return urlParse(source, false, true).resolve(relative);
	}
	
	Url.prototype.resolve = function(relative) {
	  return this.resolveObject(urlParse(relative, false, true)).format();
	};
	
	function urlResolveObject(source, relative) {
	  if (!source) return relative;
	  return urlParse(source, false, true).resolveObject(relative);
	}
	
	Url.prototype.resolveObject = function(relative) {
	  if (util.isString(relative)) {
	    var rel = new Url();
	    rel.parse(relative, false, true);
	    relative = rel;
	  }
	
	  var result = new Url();
	  var tkeys = Object.keys(this);
	  for (var tk = 0; tk < tkeys.length; tk++) {
	    var tkey = tkeys[tk];
	    result[tkey] = this[tkey];
	  }
	
	  // hash is always overridden, no matter what.
	  // even href="" will remove it.
	  result.hash = relative.hash;
	
	  // if the relative url is empty, then there's nothing left to do here.
	  if (relative.href === '') {
	    result.href = result.format();
	    return result;
	  }
	
	  // hrefs like //foo/bar always cut to the protocol.
	  if (relative.slashes && !relative.protocol) {
	    // take everything except the protocol from relative
	    var rkeys = Object.keys(relative);
	    for (var rk = 0; rk < rkeys.length; rk++) {
	      var rkey = rkeys[rk];
	      if (rkey !== 'protocol')
	        result[rkey] = relative[rkey];
	    }
	
	    //urlParse appends trailing / to urls like http://www.example.com
	    if (slashedProtocol[result.protocol] &&
	        result.hostname && !result.pathname) {
	      result.path = result.pathname = '/';
	    }
	
	    result.href = result.format();
	    return result;
	  }
	
	  if (relative.protocol && relative.protocol !== result.protocol) {
	    // if it's a known url protocol, then changing
	    // the protocol does weird things
	    // first, if it's not file:, then we MUST have a host,
	    // and if there was a path
	    // to begin with, then we MUST have a path.
	    // if it is file:, then the host is dropped,
	    // because that's known to be hostless.
	    // anything else is assumed to be absolute.
	    if (!slashedProtocol[relative.protocol]) {
	      var keys = Object.keys(relative);
	      for (var v = 0; v < keys.length; v++) {
	        var k = keys[v];
	        result[k] = relative[k];
	      }
	      result.href = result.format();
	      return result;
	    }
	
	    result.protocol = relative.protocol;
	    if (!relative.host && !hostlessProtocol[relative.protocol]) {
	      var relPath = (relative.pathname || '').split('/');
	      while (relPath.length && !(relative.host = relPath.shift()));
	      if (!relative.host) relative.host = '';
	      if (!relative.hostname) relative.hostname = '';
	      if (relPath[0] !== '') relPath.unshift('');
	      if (relPath.length < 2) relPath.unshift('');
	      result.pathname = relPath.join('/');
	    } else {
	      result.pathname = relative.pathname;
	    }
	    result.search = relative.search;
	    result.query = relative.query;
	    result.host = relative.host || '';
	    result.auth = relative.auth;
	    result.hostname = relative.hostname || relative.host;
	    result.port = relative.port;
	    // to support http.request
	    if (result.pathname || result.search) {
	      var p = result.pathname || '';
	      var s = result.search || '';
	      result.path = p + s;
	    }
	    result.slashes = result.slashes || relative.slashes;
	    result.href = result.format();
	    return result;
	  }
	
	  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
	      isRelAbs = (
	          relative.host ||
	          relative.pathname && relative.pathname.charAt(0) === '/'
	      ),
	      mustEndAbs = (isRelAbs || isSourceAbs ||
	                    (result.host && relative.pathname)),
	      removeAllDots = mustEndAbs,
	      srcPath = result.pathname && result.pathname.split('/') || [],
	      relPath = relative.pathname && relative.pathname.split('/') || [],
	      psychotic = result.protocol && !slashedProtocol[result.protocol];
	
	  // if the url is a non-slashed url, then relative
	  // links like ../.. should be able
	  // to crawl up to the hostname, as well.  This is strange.
	  // result.protocol has already been set by now.
	  // Later on, put the first path part into the host field.
	  if (psychotic) {
	    result.hostname = '';
	    result.port = null;
	    if (result.host) {
	      if (srcPath[0] === '') srcPath[0] = result.host;
	      else srcPath.unshift(result.host);
	    }
	    result.host = '';
	    if (relative.protocol) {
	      relative.hostname = null;
	      relative.port = null;
	      if (relative.host) {
	        if (relPath[0] === '') relPath[0] = relative.host;
	        else relPath.unshift(relative.host);
	      }
	      relative.host = null;
	    }
	    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
	  }
	
	  if (isRelAbs) {
	    // it's absolute.
	    result.host = (relative.host || relative.host === '') ?
	                  relative.host : result.host;
	    result.hostname = (relative.hostname || relative.hostname === '') ?
	                      relative.hostname : result.hostname;
	    result.search = relative.search;
	    result.query = relative.query;
	    srcPath = relPath;
	    // fall through to the dot-handling below.
	  } else if (relPath.length) {
	    // it's relative
	    // throw away the existing file, and take the new path instead.
	    if (!srcPath) srcPath = [];
	    srcPath.pop();
	    srcPath = srcPath.concat(relPath);
	    result.search = relative.search;
	    result.query = relative.query;
	  } else if (!util.isNullOrUndefined(relative.search)) {
	    // just pull out the search.
	    // like href='?foo'.
	    // Put this after the other two cases because it simplifies the booleans
	    if (psychotic) {
	      result.hostname = result.host = srcPath.shift();
	      //occationaly the auth can get stuck only in host
	      //this especially happens in cases like
	      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
	      var authInHost = result.host && result.host.indexOf('@') > 0 ?
	                       result.host.split('@') : false;
	      if (authInHost) {
	        result.auth = authInHost.shift();
	        result.host = result.hostname = authInHost.shift();
	      }
	    }
	    result.search = relative.search;
	    result.query = relative.query;
	    //to support http.request
	    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
	      result.path = (result.pathname ? result.pathname : '') +
	                    (result.search ? result.search : '');
	    }
	    result.href = result.format();
	    return result;
	  }
	
	  if (!srcPath.length) {
	    // no path at all.  easy.
	    // we've already handled the other stuff above.
	    result.pathname = null;
	    //to support http.request
	    if (result.search) {
	      result.path = '/' + result.search;
	    } else {
	      result.path = null;
	    }
	    result.href = result.format();
	    return result;
	  }
	
	  // if a url ENDs in . or .., then it must get a trailing slash.
	  // however, if it ends in anything else non-slashy,
	  // then it must NOT get a trailing slash.
	  var last = srcPath.slice(-1)[0];
	  var hasTrailingSlash = (
	      (result.host || relative.host || srcPath.length > 1) &&
	      (last === '.' || last === '..') || last === '');
	
	  // strip single dots, resolve double dots to parent dir
	  // if the path tries to go above the root, `up` ends up > 0
	  var up = 0;
	  for (var i = srcPath.length; i >= 0; i--) {
	    last = srcPath[i];
	    if (last === '.') {
	      srcPath.splice(i, 1);
	    } else if (last === '..') {
	      srcPath.splice(i, 1);
	      up++;
	    } else if (up) {
	      srcPath.splice(i, 1);
	      up--;
	    }
	  }
	
	  // if the path is allowed to go above the root, restore leading ..s
	  if (!mustEndAbs && !removeAllDots) {
	    for (; up--; up) {
	      srcPath.unshift('..');
	    }
	  }
	
	  if (mustEndAbs && srcPath[0] !== '' &&
	      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
	    srcPath.unshift('');
	  }
	
	  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
	    srcPath.push('');
	  }
	
	  var isAbsolute = srcPath[0] === '' ||
	      (srcPath[0] && srcPath[0].charAt(0) === '/');
	
	  // put the host back
	  if (psychotic) {
	    result.hostname = result.host = isAbsolute ? '' :
	                                    srcPath.length ? srcPath.shift() : '';
	    //occationaly the auth can get stuck only in host
	    //this especially happens in cases like
	    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
	    var authInHost = result.host && result.host.indexOf('@') > 0 ?
	                     result.host.split('@') : false;
	    if (authInHost) {
	      result.auth = authInHost.shift();
	      result.host = result.hostname = authInHost.shift();
	    }
	  }
	
	  mustEndAbs = mustEndAbs || (result.host && srcPath.length);
	
	  if (mustEndAbs && !isAbsolute) {
	    srcPath.unshift('');
	  }
	
	  if (!srcPath.length) {
	    result.pathname = null;
	    result.path = null;
	  } else {
	    result.pathname = srcPath.join('/');
	  }
	
	  //to support request.http
	  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
	    result.path = (result.pathname ? result.pathname : '') +
	                  (result.search ? result.search : '');
	  }
	  result.auth = relative.auth || result.auth;
	  result.slashes = result.slashes || relative.slashes;
	  result.href = result.format();
	  return result;
	};
	
	Url.prototype.parseHost = function() {
	  var host = this.host;
	  var port = portPattern.exec(host);
	  if (port) {
	    port = port[0];
	    if (port !== ':') {
	      this.port = port.substr(1);
	    }
	    host = host.substr(0, host.length - port.length);
	  }
	  if (host) this.hostname = host;
	};


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module, global) {/*! https://mths.be/punycode v1.3.2 by @mathias */
	;(function(root) {
	
		/** Detect free variables */
		var freeExports = typeof exports == 'object' && exports &&
			!exports.nodeType && exports;
		var freeModule = typeof module == 'object' && module &&
			!module.nodeType && module;
		var freeGlobal = typeof global == 'object' && global;
		if (
			freeGlobal.global === freeGlobal ||
			freeGlobal.window === freeGlobal ||
			freeGlobal.self === freeGlobal
		) {
			root = freeGlobal;
		}
	
		/**
		 * The `punycode` object.
		 * @name punycode
		 * @type Object
		 */
		var punycode,
	
		/** Highest positive signed 32-bit float value */
		maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1
	
		/** Bootstring parameters */
		base = 36,
		tMin = 1,
		tMax = 26,
		skew = 38,
		damp = 700,
		initialBias = 72,
		initialN = 128, // 0x80
		delimiter = '-', // '\x2D'
	
		/** Regular expressions */
		regexPunycode = /^xn--/,
		regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
		regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators
	
		/** Error messages */
		errors = {
			'overflow': 'Overflow: input needs wider integers to process',
			'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
			'invalid-input': 'Invalid input'
		},
	
		/** Convenience shortcuts */
		baseMinusTMin = base - tMin,
		floor = Math.floor,
		stringFromCharCode = String.fromCharCode,
	
		/** Temporary variable */
		key;
	
		/*--------------------------------------------------------------------------*/
	
		/**
		 * A generic error utility function.
		 * @private
		 * @param {String} type The error type.
		 * @returns {Error} Throws a `RangeError` with the applicable error message.
		 */
		function error(type) {
			throw RangeError(errors[type]);
		}
	
		/**
		 * A generic `Array#map` utility function.
		 * @private
		 * @param {Array} array The array to iterate over.
		 * @param {Function} callback The function that gets called for every array
		 * item.
		 * @returns {Array} A new array of values returned by the callback function.
		 */
		function map(array, fn) {
			var length = array.length;
			var result = [];
			while (length--) {
				result[length] = fn(array[length]);
			}
			return result;
		}
	
		/**
		 * A simple `Array#map`-like wrapper to work with domain name strings or email
		 * addresses.
		 * @private
		 * @param {String} domain The domain name or email address.
		 * @param {Function} callback The function that gets called for every
		 * character.
		 * @returns {Array} A new string of characters returned by the callback
		 * function.
		 */
		function mapDomain(string, fn) {
			var parts = string.split('@');
			var result = '';
			if (parts.length > 1) {
				// In email addresses, only the domain name should be punycoded. Leave
				// the local part (i.e. everything up to `@`) intact.
				result = parts[0] + '@';
				string = parts[1];
			}
			// Avoid `split(regex)` for IE8 compatibility. See #17.
			string = string.replace(regexSeparators, '\x2E');
			var labels = string.split('.');
			var encoded = map(labels, fn).join('.');
			return result + encoded;
		}
	
		/**
		 * Creates an array containing the numeric code points of each Unicode
		 * character in the string. While JavaScript uses UCS-2 internally,
		 * this function will convert a pair of surrogate halves (each of which
		 * UCS-2 exposes as separate characters) into a single code point,
		 * matching UTF-16.
		 * @see `punycode.ucs2.encode`
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode.ucs2
		 * @name decode
		 * @param {String} string The Unicode input string (UCS-2).
		 * @returns {Array} The new array of code points.
		 */
		function ucs2decode(string) {
			var output = [],
			    counter = 0,
			    length = string.length,
			    value,
			    extra;
			while (counter < length) {
				value = string.charCodeAt(counter++);
				if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
					// high surrogate, and there is a next character
					extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // low surrogate
						output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
					} else {
						// unmatched surrogate; only append this code unit, in case the next
						// code unit is the high surrogate of a surrogate pair
						output.push(value);
						counter--;
					}
				} else {
					output.push(value);
				}
			}
			return output;
		}
	
		/**
		 * Creates a string based on an array of numeric code points.
		 * @see `punycode.ucs2.decode`
		 * @memberOf punycode.ucs2
		 * @name encode
		 * @param {Array} codePoints The array of numeric code points.
		 * @returns {String} The new Unicode string (UCS-2).
		 */
		function ucs2encode(array) {
			return map(array, function(value) {
				var output = '';
				if (value > 0xFFFF) {
					value -= 0x10000;
					output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
					value = 0xDC00 | value & 0x3FF;
				}
				output += stringFromCharCode(value);
				return output;
			}).join('');
		}
	
		/**
		 * Converts a basic code point into a digit/integer.
		 * @see `digitToBasic()`
		 * @private
		 * @param {Number} codePoint The basic numeric code point value.
		 * @returns {Number} The numeric value of a basic code point (for use in
		 * representing integers) in the range `0` to `base - 1`, or `base` if
		 * the code point does not represent a value.
		 */
		function basicToDigit(codePoint) {
			if (codePoint - 48 < 10) {
				return codePoint - 22;
			}
			if (codePoint - 65 < 26) {
				return codePoint - 65;
			}
			if (codePoint - 97 < 26) {
				return codePoint - 97;
			}
			return base;
		}
	
		/**
		 * Converts a digit/integer into a basic code point.
		 * @see `basicToDigit()`
		 * @private
		 * @param {Number} digit The numeric value of a basic code point.
		 * @returns {Number} The basic code point whose value (when used for
		 * representing integers) is `digit`, which needs to be in the range
		 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
		 * used; else, the lowercase form is used. The behavior is undefined
		 * if `flag` is non-zero and `digit` has no uppercase form.
		 */
		function digitToBasic(digit, flag) {
			//  0..25 map to ASCII a..z or A..Z
			// 26..35 map to ASCII 0..9
			return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
		}
	
		/**
		 * Bias adaptation function as per section 3.4 of RFC 3492.
		 * http://tools.ietf.org/html/rfc3492#section-3.4
		 * @private
		 */
		function adapt(delta, numPoints, firstTime) {
			var k = 0;
			delta = firstTime ? floor(delta / damp) : delta >> 1;
			delta += floor(delta / numPoints);
			for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
				delta = floor(delta / baseMinusTMin);
			}
			return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
		}
	
		/**
		 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
		 * symbols.
		 * @memberOf punycode
		 * @param {String} input The Punycode string of ASCII-only symbols.
		 * @returns {String} The resulting string of Unicode symbols.
		 */
		function decode(input) {
			// Don't use UCS-2
			var output = [],
			    inputLength = input.length,
			    out,
			    i = 0,
			    n = initialN,
			    bias = initialBias,
			    basic,
			    j,
			    index,
			    oldi,
			    w,
			    k,
			    digit,
			    t,
			    /** Cached calculation results */
			    baseMinusT;
	
			// Handle the basic code points: let `basic` be the number of input code
			// points before the last delimiter, or `0` if there is none, then copy
			// the first basic code points to the output.
	
			basic = input.lastIndexOf(delimiter);
			if (basic < 0) {
				basic = 0;
			}
	
			for (j = 0; j < basic; ++j) {
				// if it's not a basic code point
				if (input.charCodeAt(j) >= 0x80) {
					error('not-basic');
				}
				output.push(input.charCodeAt(j));
			}
	
			// Main decoding loop: start just after the last delimiter if any basic code
			// points were copied; start at the beginning otherwise.
	
			for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {
	
				// `index` is the index of the next character to be consumed.
				// Decode a generalized variable-length integer into `delta`,
				// which gets added to `i`. The overflow checking is easier
				// if we increase `i` as we go, then subtract off its starting
				// value at the end to obtain `delta`.
				for (oldi = i, w = 1, k = base; /* no condition */; k += base) {
	
					if (index >= inputLength) {
						error('invalid-input');
					}
	
					digit = basicToDigit(input.charCodeAt(index++));
	
					if (digit >= base || digit > floor((maxInt - i) / w)) {
						error('overflow');
					}
	
					i += digit * w;
					t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
	
					if (digit < t) {
						break;
					}
	
					baseMinusT = base - t;
					if (w > floor(maxInt / baseMinusT)) {
						error('overflow');
					}
	
					w *= baseMinusT;
	
				}
	
				out = output.length + 1;
				bias = adapt(i - oldi, out, oldi == 0);
	
				// `i` was supposed to wrap around from `out` to `0`,
				// incrementing `n` each time, so we'll fix that now:
				if (floor(i / out) > maxInt - n) {
					error('overflow');
				}
	
				n += floor(i / out);
				i %= out;
	
				// Insert `n` at position `i` of the output
				output.splice(i++, 0, n);
	
			}
	
			return ucs2encode(output);
		}
	
		/**
		 * Converts a string of Unicode symbols (e.g. a domain name label) to a
		 * Punycode string of ASCII-only symbols.
		 * @memberOf punycode
		 * @param {String} input The string of Unicode symbols.
		 * @returns {String} The resulting Punycode string of ASCII-only symbols.
		 */
		function encode(input) {
			var n,
			    delta,
			    handledCPCount,
			    basicLength,
			    bias,
			    j,
			    m,
			    q,
			    k,
			    t,
			    currentValue,
			    output = [],
			    /** `inputLength` will hold the number of code points in `input`. */
			    inputLength,
			    /** Cached calculation results */
			    handledCPCountPlusOne,
			    baseMinusT,
			    qMinusT;
	
			// Convert the input in UCS-2 to Unicode
			input = ucs2decode(input);
	
			// Cache the length
			inputLength = input.length;
	
			// Initialize the state
			n = initialN;
			delta = 0;
			bias = initialBias;
	
			// Handle the basic code points
			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue < 0x80) {
					output.push(stringFromCharCode(currentValue));
				}
			}
	
			handledCPCount = basicLength = output.length;
	
			// `handledCPCount` is the number of code points that have been handled;
			// `basicLength` is the number of basic code points.
	
			// Finish the basic string - if it is not empty - with a delimiter
			if (basicLength) {
				output.push(delimiter);
			}
	
			// Main encoding loop:
			while (handledCPCount < inputLength) {
	
				// All non-basic code points < n have been handled already. Find the next
				// larger one:
				for (m = maxInt, j = 0; j < inputLength; ++j) {
					currentValue = input[j];
					if (currentValue >= n && currentValue < m) {
						m = currentValue;
					}
				}
	
				// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
				// but guard against overflow
				handledCPCountPlusOne = handledCPCount + 1;
				if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
					error('overflow');
				}
	
				delta += (m - n) * handledCPCountPlusOne;
				n = m;
	
				for (j = 0; j < inputLength; ++j) {
					currentValue = input[j];
	
					if (currentValue < n && ++delta > maxInt) {
						error('overflow');
					}
	
					if (currentValue == n) {
						// Represent delta as a generalized variable-length integer
						for (q = delta, k = base; /* no condition */; k += base) {
							t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
							if (q < t) {
								break;
							}
							qMinusT = q - t;
							baseMinusT = base - t;
							output.push(
								stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
							);
							q = floor(qMinusT / baseMinusT);
						}
	
						output.push(stringFromCharCode(digitToBasic(q, 0)));
						bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
						delta = 0;
						++handledCPCount;
					}
				}
	
				++delta;
				++n;
	
			}
			return output.join('');
		}
	
		/**
		 * Converts a Punycode string representing a domain name or an email address
		 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
		 * it doesn't matter if you call it on a string that has already been
		 * converted to Unicode.
		 * @memberOf punycode
		 * @param {String} input The Punycoded domain name or email address to
		 * convert to Unicode.
		 * @returns {String} The Unicode representation of the given Punycode
		 * string.
		 */
		function toUnicode(input) {
			return mapDomain(input, function(string) {
				return regexPunycode.test(string)
					? decode(string.slice(4).toLowerCase())
					: string;
			});
		}
	
		/**
		 * Converts a Unicode string representing a domain name or an email address to
		 * Punycode. Only the non-ASCII parts of the domain name will be converted,
		 * i.e. it doesn't matter if you call it with a domain that's already in
		 * ASCII.
		 * @memberOf punycode
		 * @param {String} input The domain name or email address to convert, as a
		 * Unicode string.
		 * @returns {String} The Punycode representation of the given domain name or
		 * email address.
		 */
		function toASCII(input) {
			return mapDomain(input, function(string) {
				return regexNonASCII.test(string)
					? 'xn--' + encode(string)
					: string;
			});
		}
	
		/*--------------------------------------------------------------------------*/
	
		/** Define the public API */
		punycode = {
			/**
			 * A string representing the current Punycode.js version number.
			 * @memberOf punycode
			 * @type String
			 */
			'version': '1.3.2',
			/**
			 * An object of methods to convert from JavaScript's internal character
			 * representation (UCS-2) to Unicode code points, and back.
			 * @see <https://mathiasbynens.be/notes/javascript-encoding>
			 * @memberOf punycode
			 * @type Object
			 */
			'ucs2': {
				'decode': ucs2decode,
				'encode': ucs2encode
			},
			'decode': decode,
			'encode': encode,
			'toASCII': toASCII,
			'toUnicode': toUnicode
		};
	
		/** Expose `punycode` */
		// Some AMD build optimizers, like r.js, check for specific condition patterns
		// like the following:
		if (
			true
		) {
			!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
				return punycode;
			}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		} else if (freeExports && freeModule) {
			if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
				freeModule.exports = punycode;
			} else { // in Narwhal or RingoJS v0.7.0-
				for (key in punycode) {
					punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
				}
			}
		} else { // in Rhino or a web browser
			root.punycode = punycode;
		}
	
	}(this));
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(42)(module), (function() { return this; }())))

/***/ }),
/* 42 */
/***/ (function(module, exports) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ }),
/* 43 */
/***/ (function(module, exports) {

	'use strict';
	
	module.exports = {
	  isString: function(arg) {
	    return typeof(arg) === 'string';
	  },
	  isObject: function(arg) {
	    return typeof(arg) === 'object' && arg !== null;
	  },
	  isNull: function(arg) {
	    return arg === null;
	  },
	  isNullOrUndefined: function(arg) {
	    return arg == null;
	  }
	};


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	exports.decode = exports.parse = __webpack_require__(45);
	exports.encode = exports.stringify = __webpack_require__(46);


/***/ }),
/* 45 */
/***/ (function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	
	'use strict';
	
	// If obj.hasOwnProperty has been overridden, then calling
	// obj.hasOwnProperty(prop) will break.
	// See: https://github.com/joyent/node/issues/1707
	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}
	
	module.exports = function(qs, sep, eq, options) {
	  sep = sep || '&';
	  eq = eq || '=';
	  var obj = {};
	
	  if (typeof qs !== 'string' || qs.length === 0) {
	    return obj;
	  }
	
	  var regexp = /\+/g;
	  qs = qs.split(sep);
	
	  var maxKeys = 1000;
	  if (options && typeof options.maxKeys === 'number') {
	    maxKeys = options.maxKeys;
	  }
	
	  var len = qs.length;
	  // maxKeys <= 0 means that we should not limit keys count
	  if (maxKeys > 0 && len > maxKeys) {
	    len = maxKeys;
	  }
	
	  for (var i = 0; i < len; ++i) {
	    var x = qs[i].replace(regexp, '%20'),
	        idx = x.indexOf(eq),
	        kstr, vstr, k, v;
	
	    if (idx >= 0) {
	      kstr = x.substr(0, idx);
	      vstr = x.substr(idx + 1);
	    } else {
	      kstr = x;
	      vstr = '';
	    }
	
	    k = decodeURIComponent(kstr);
	    v = decodeURIComponent(vstr);
	
	    if (!hasOwnProperty(obj, k)) {
	      obj[k] = v;
	    } else if (Array.isArray(obj[k])) {
	      obj[k].push(v);
	    } else {
	      obj[k] = [obj[k], v];
	    }
	  }
	
	  return obj;
	};


/***/ }),
/* 46 */
/***/ (function(module, exports) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	
	'use strict';
	
	var stringifyPrimitive = function(v) {
	  switch (typeof v) {
	    case 'string':
	      return v;
	
	    case 'boolean':
	      return v ? 'true' : 'false';
	
	    case 'number':
	      return isFinite(v) ? v : '';
	
	    default:
	      return '';
	  }
	};
	
	module.exports = function(obj, sep, eq, name) {
	  sep = sep || '&';
	  eq = eq || '=';
	  if (obj === null) {
	    obj = undefined;
	  }
	
	  if (typeof obj === 'object') {
	    return Object.keys(obj).map(function(k) {
	      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
	      if (Array.isArray(obj[k])) {
	        return obj[k].map(function(v) {
	          return ks + encodeURIComponent(stringifyPrimitive(v));
	        }).join(sep);
	      } else {
	        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
	      }
	    }).join(sep);
	
	  }
	
	  if (!name) return '';
	  return encodeURIComponent(stringifyPrimitive(name)) + eq +
	         encodeURIComponent(stringifyPrimitive(obj));
	};


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

	var enrollmentAttempt = __webpack_require__(48);
	var enrollment = __webpack_require__(49);
	var transaction = __webpack_require__(50);
	var jwtToken = __webpack_require__(24);
	var object = __webpack_require__(3);
	
	exports.fromStartFlow = function buildTransactionFromStartFlow(data, options) {
	  var txLegacyData = data.txLegacyData;
	  var issuer = data.issuer;
	  var serviceUrl = data.serviceUrl;
	  var accountLabel = data.accountLabel;
	  var transactionToken = data.transactionToken;
	  var txData = {};
	
	  txData.transactionToken = transactionToken;
	  txData.availableEnrollmentMethods = txLegacyData.availableEnrollmentMethods;
	  txData.availableAuthenticationMethods = txLegacyData.availableAuthenticationMethods;
	
	  if (txLegacyData.enrollmentTxId) {
	    txData.enrollmentAttempt = enrollmentAttempt({
	      enrollmentId: txLegacyData.deviceAccount.id,
	      enrollmentTxId: txLegacyData.enrollmentTxId,
	      otpSecret: txLegacyData.deviceAccount.otpSecret,
	      recoveryCode: txLegacyData.deviceAccount.recoveryCode,
	      issuer: issuer,
	      baseUrl: serviceUrl,
	      accountLabel: accountLabel
	    });
	  } else {
	    var defaultEnrollment = enrollment({
	      methods: txLegacyData.deviceAccount.methods,
	      availableMethods: txLegacyData.deviceAccount.availableMethods,
	      name: txLegacyData.deviceAccount.name,
	      phoneNumber: txLegacyData.deviceAccount.phoneNumber
	    });
	
	    txData.enrollments = [defaultEnrollment];
	  }
	
	  return transaction(txData, options);
	};
	/**
	 * @param {string} transactionState.transactionToken
	 *
	 * @param {undefined|Object} transactionState.enrollmentAttempt
	 * @param {Object} transactionState.enrollmentAttempt.data - @see enrollmentAttempt
	 * @param {boolean} transactionState.enrollmentAttempt.active
	 *
	 * @param {object[]} transactionState.enrollments - @see enrollment
	
	 * @param {object} transactionState.availableEnrollmentMethods
	 * @param {object} transactionState.availableAuthenticationMethods
	 *
	 * @param {EventEmitter} options.transactionEventsReceiver
	 * Receiver for transaction events; it will receive  backend related transaction events
	 *
	 * @param {object} transactionState.authVerificationStep
	 * @param {otp|push|sms} transactionState.authVerificationStep.method
	 *
	 * @param {object} transactionState.enrollmentConfirmationStep
	 * @param {otp|push|sms} transactionState.enrollmentConfirmationStep.method
	 *
	 * @param {HttpClient} options.HttpClient
	 *
	 * @returns {Transaction}
	 */
	exports.fromTransactionState = function fromTransactionState(transactionState, options) {
	  var txData = {
	    transactionToken: jwtToken(transactionState.transactionToken),
	    enrollments: object.map(transactionState.enrollments, enrollment),
	    availableEnrollmentMethods: transactionState.availableEnrollmentMethods,
	    availableAuthenticationMethods: transactionState.availableAuthenticationMethods,
	    authVerificationStep: transactionState.authVerificationStep,
	    enrollmentConfirmationStep: transactionState.enrollmentConfirmationStep
	  };
	
	  if (transactionState.enrollmentAttempt) {
	    txData.enrollmentAttempt = enrollmentAttempt(
	      transactionState.enrollmentAttempt.data,
	      transactionState.enrollmentAttempt.active
	    );
	  }
	
	  return transaction(txData, options);
	};


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * Represents a not-yet-complete enrollment; once it is complete an enrollment
	 * will be created instead
	 *
	 * @param {string} data.enrollmentTxId
	 * @param {string} data.otpSecret
	 * @param {string} data.issuer.name
	 * @param {string} data.issuer.label
	 * @param {string} data.recoveryCode
	 * @param {string} data.baseUrl
	 * @param {string} data.enrollmentId
	 *
	 * @param {boolean} active
	 *
	 * @private
	 */
	function enrollmentAttempt(data, active) {
	  var self = object.create(enrollmentAttempt.prototype);
	
	  self.data = data;
	  self.active = active || false;
	
	  return self;
	}
	
	/**
	 * @returns {string} Returns enrollment transaction id to send to the device as part of the qr
	 *  for Guardian enrollment
	 */
	enrollmentAttempt.prototype.getEnrollmentTransactionId = function getEnrollmentTransactionId() {
	  return this.data.enrollmentTxId;
	};
	
	/**
	 * @returns {string} Returns shared secret to include in the QR
	 */
	enrollmentAttempt.prototype.getOtpSecret = function getOtpSecret() {
	  return this.data.otpSecret;
	};
	
	/**
	 * @returns {string} Returns issuer identifier for the enrollment in the device. It is usually
	 *   tenant name
	 */
	enrollmentAttempt.prototype.getIssuerName = function getIssuerName() {
	  return this.data.issuer.name;
	};
	
	/**
	 * @returns {string} Returns issuer name for the enrollment in the device. It is usually
	 *   tenant's friendly name
	 */
	enrollmentAttempt.prototype.getIssuerLabel = function getIssuerLabel() {
	  return this.data.issuer.label;
	};
	
	/**
	 * @returns {string} Returns the label for the account on your mobile
	 * device
	 */
	enrollmentAttempt.prototype.getAccountLabel = function getAccountLabel() {
	  return this.data.accountLabel;
	};
	
	/**
	 * @returns {string} Returns recovery code for enrollment attempt (if any)
	 */
	enrollmentAttempt.prototype.getRecoveryCode = function getRecoveryCode() {
	  return this.data.recoveryCode;
	};
	
	/**
	 * @param {sms|push|otp} method
	 *
	 * @returns {boolean} Return true if the transaction needs a separate authentication
	 */
	enrollmentAttempt.prototype.isAuthRequired = function isAuthRequired(method) {
	  return method === 'push';
	};
	
	enrollmentAttempt.prototype.getEnrollmentId = function getEnrollmentId() {
	  return this.data.enrollmentId;
	};
	
	enrollmentAttempt.prototype.getBaseUri = function getBaseUri() {
	  return this.data.baseUrl;
	};
	
	/**
	 * @private
	 *
	 * NOTE: setActive and isActive are workaround methods for push notification
	 * enrollment-complete message with no transaction id
	 *
	 * @param {boolean} active
	 */
	enrollmentAttempt.prototype.setActive = function setActive(active) {
	  this.active = active;
	};
	
	/**
	 * @private
	 *
	 * NOTE: setActive and isActive are workaround methods for push notification
	 * enrollment-complete message with no transaction id
	 */
	enrollmentAttempt.prototype.isActive = function isActive() {
	  return this.active;
	};
	
	/**
	 * @public
	 *
	 * @returns {{data: *, active: *}} @see constructor
	 */
	enrollmentAttempt.prototype.serialize = function serialize() {
	  return {
	    data: this.data,
	    active: this.active
	  };
	};
	
	module.exports = enrollmentAttempt;


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * Represents a complete enrollment with its associated data
	 *
	 * @param {string} [data.name] Enrollment name
	 * @param {string} [data.phoneNumber] Enrollment phone number (masked)
	 * @param {array.<sms|push|otp>} data.availableMethods
	 *
	 * @public
	 * @returns {Enrollment}
	 */
	function enrollment(data) {
	  var self = object.create(enrollment.prototype);
	
	  self.data = data;
	
	  return self;
	}
	
	/**
	 * @returns {array.<string>} available methods: push|sms|otp
	 */
	enrollment.prototype.getAvailableMethods = function getAvailableMethods() {
	  return this.data.availableMethods;
	};
	
	/**
	 * @returns {array.<string>} methods associated with the enrollment: push|sms|otp
	 */
	enrollment.prototype.getMethods = function getMethods() {
	  return this.data.methods;
	};
	
	/**
	 * @returns {string} returns name or undefined if not present
	 */
	enrollment.prototype.getName = function getName() {
	  return this.data.name;
	};
	
	/**
	 * @returns {string} returns masked phone number
	 */
	enrollment.prototype.getPhoneNumber = function getPhoneNumber() {
	  return this.data.phoneNumber;
	};
	
	/**
	 * @returns @see constructor.
	 */
	enrollment.prototype.serialize = function serialize() {
	  return this.data;
	};
	
	module.exports = enrollment;


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	var errors = __webpack_require__(8);
	var enrollmentBuilder = __webpack_require__(49);
	var helpers = __webpack_require__(51);
	
	var authVerificationStep = __webpack_require__(52);
	var enrollmentConfirmationStep = __webpack_require__(54);
	
	var authRecoveryStrategy = __webpack_require__(55);
	
	var smsEnrollmentStrategy = __webpack_require__(57);
	var pnEnrollmentStrategy = __webpack_require__(58);
	var otpEnrollmentStrategy = __webpack_require__(60);
	
	var smsAuthStrategy = __webpack_require__(61);
	var pnAuthStrategy = __webpack_require__(63);
	var otpAuthStrategy = __webpack_require__(62);
	
	var eventSequencer = __webpack_require__(64);
	var eventListenerHub = __webpack_require__(65);
	var events = __webpack_require__(53);
	
	var VALID_METHODS = ['otp', 'sms', 'push'];
	
	/**
	 * @public
	 *
	 * Represents a Guardian transaction
	 *
	 * @param {array.<Enrollment>} data.enrollments
	 *  Confirmed enrollments (available when you are enrolled)
	 * @param {array.<EnrollmentAttempt>} [data.enrollmentAttempt]
	 *  Enrollment attempt (when you are not enrolled)
	 * @param {array.<string>} data.availableEnrollmentMethods
	 * @param {JWTToken} data.transactionToken
	 *
	 * @param {object} [data.authVerificationStep]
	 * @param {otp|push|sms} data.authVerificationStep.method
	 *
	 * @param {object} [data.enrollmentConfirmationStep]
	 * @param {otp|push|sms} data.enrollmentConfirmationStep.method
	 *
	 * @param {EventEmitter} options.transactionEventsReceiver
	 *  Receiver for transaction events; it will receive  backend related transaction events
	 * @param {HttpClient} options.HttpClient
	 *
	 * @returns {Transaction}
	 */
	function transaction(data, options) {
	  var self = object.create(transaction.prototype);
	
	  var httpClient = options.httpClient;
	  self.httpClient = httpClient;
	
	  var enrollmentStrategyData = {
	    enrollmentAttempt: data.enrollmentAttempt,
	    transactionToken: data.transactionToken
	  };
	
	  self.enrollmentStrategies = {
	    sms: smsEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient }),
	    push: pnEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient }),
	    otp: otpEnrollmentStrategy(enrollmentStrategyData, { httpClient: httpClient })
	  };
	
	  var authStrategiesData = { transactionToken: data.transactionToken };
	
	  self.authStrategies = {
	    sms: smsAuthStrategy(authStrategiesData, { httpClient: httpClient }),
	    push: pnAuthStrategy(authStrategiesData, { httpClient: httpClient }),
	    otp: otpAuthStrategy(authStrategiesData, { httpClient: httpClient })
	  };
	
	  self.authRecoveryStrategy = authRecoveryStrategy(authStrategiesData, { httpClient: httpClient });
	
	  self.enrollmentAttempt = data.enrollmentAttempt;
	  self.enrollments = data.enrollments || [];
	
	  self.txId = data.transactionToken.getDecoded().txid;
	  self.transactionToken = data.transactionToken;
	  self.transactionEventsReceiver = options.transactionEventsReceiver;
	  self.availableEnrollmentMethods = data.availableEnrollmentMethods;
	  self.availableAuthenticationMethods = data.availableAuthenticationMethods;
	
	  self.loginCompleteHub = eventListenerHub(
	    self.transactionEventsReceiver, 'login:complete');
	  self.loginRejectedHub = eventListenerHub(
	    self.transactionEventsReceiver, 'login:rejected');
	  self.enrollmentCompleteHub = eventListenerHub(
	    self.transactionEventsReceiver, 'enrollment:confirmed');
	
	  self.eventSequencer = eventSequencer();
	  self.eventSequencer.pipe(self);
	
	  self.enrollmentCompleteHub.defaultHandler(function enrollmentCompleteDef(apiPayload) {
	    var newEnrollment = enrollmentBuilder(apiPayload.deviceAccount);
	    self.addEnrollment(newEnrollment);
	
	    // This is a workaround to prevent an edge case for when the enrollment
	    // is not from current tx. It doesn't avoid it completely but reduces
	    // its likehood.
	    //
	    // The source of the problem is that the transaction id is not easily
	    // available from the mobile device
	    var isEnrollmentAttemptActive = object.execute(data.enrollmentAttempt, 'isActive');
	
	    // eslint-disable-next-line no-param-reassign
	    apiPayload.txId = !apiPayload.txId && isEnrollmentAttemptActive ? self.txId : apiPayload.txId;
	
	    if (apiPayload.txId !== self.txId) {
	      self.dismissEnrollmentAttempt();
	    }
	
	    self.eventSequencer.emit('enrollment-complete', helpers.buildEnrollmentCompletePayload({
	      enrollment: newEnrollment,
	      apiPayload: apiPayload,
	      txId: self.txId,
	      enrollmentAttempt: data.enrollmentAttempt,
	      method: apiPayload.method || 'push' // TODO Remove
	    }));
	  });
	
	  self.loginCompleteHub.defaultHandler(function loginCompleteDef(apiPayload) {
	    self.eventSequencer.emit('auth-response',
	      helpers.buildAuthCompletionPayload(true, apiPayload.signature));
	  });
	
	  self.loginRejectedHub.defaultHandler(function loginCompleteDef() {
	    self.eventSequencer.emit('auth-response',
	      helpers.buildAuthCompletionPayload(false, null));
	  });
	
	  self.transactionToken.on('token-expired', function tokenExpiredDef() {
	    self.eventSequencer.emit('timeout');
	  });
	
	  self.transactionEventsReceiver.on('error', function onError(err) {
	    self.eventSequencer.emit('error', err);
	  });
	
	  self.authVerificationStep = data.authVerificationStep;
	  self.enrollmentConfirmationStep = data.enrollmentConfirmationStep;
	
	  if (data.enrollmentConfirmationStep && data.enrollmentConfirmationStep.method) {
	    self.enrollmentConfirmationStep = self.buildEnrollmentConfirmationStep(
	      data.enrollmentConfirmationStep);
	  }
	
	  if (data.authVerificationStep && data.authVerificationStep.method) {
	    self.authVerificationStep = self.buildAuthVerificationStep(
	      data.authVerificationStep);
	  }
	
	  return self;
	}
	
	transaction.prototype = object.create(EventEmitter.prototype);
	
	/**
	 * @param {object} data
	 * @param {otp|push|sms} data.method
	 */
	transaction.prototype.buildAuthVerificationStep = function buildAuthVerificationStep(data) {
	  var self = this;
	
	  if (typeof data !== 'object') {
	    throw new errors.UnexpectedInputError('Expected data to be an object');
	  }
	
	  if (VALID_METHODS.indexOf(data.method) < 0) {
	    throw new errors.UnexpectedInputError('Expected data.method to be one of ' +
	      VALID_METHODS.join(', ') + ' but found ' + data.method);
	  }
	
	  if (!self.isEnrolled()) {
	    throw new errors.InvalidStateError('Expected user to be enrolled');
	  }
	
	  return authVerificationStep(self.authStrategies[data.method], {
	    loginCompleteHub: self.loginCompleteHub,
	    loginRejectedHub: self.loginRejectedHub,
	    transaction: self
	  });
	};
	
	/**
	 * @param {object} data
	 * @param {otp|push|sms} data.method
	 */
	transaction.prototype.buildEnrollmentConfirmationStep =
	  function buildEnrollmentConfirmationStep(data) {
	    var self = this;
	
	    if (typeof data !== 'object') {
	      throw new errors.UnexpectedInputError('Expected data to be an object');
	    }
	
	    if (VALID_METHODS.indexOf(data.method) < 0) {
	      throw new errors.UnexpectedInputError('Expected data.method to be one of ' +
	        VALID_METHODS.join(', ') + ' but found ' + data.method);
	    }
	
	    if (!self.enrollmentAttempt) {
	      throw new errors.InvalidStateError('Expected enrollment attempt to be present: ' +
	        'try calling .enroll method first');
	    }
	    return enrollmentConfirmationStep({
	      strategy: self.enrollmentStrategies[data.method],
	      enrollmentAttempt: self.enrollmentAttempt,
	      enrollmentCompleteHub: self.enrollmentCompleteHub,
	      transaction: self
	    });
	  };
	
	/**
	 * @Public
	 *
	 * This methods return an object that represents the the inner state of the transaction. Is useful
	 * to store some where this state and resume this transaction later.
	 *
	 * @returns {Object}
	 *
	 */
	transaction.prototype.serialize = function serialize() {
	  var self = this;
	
	  function enrollmentSerialize(enrollment) {
	    return enrollment.serialize();
	  }
	
	  var data = {
	    transactionToken: this.transactionToken.getToken(),
	    baseUrl: this.httpClient.getBaseUrl(),
	    availableEnrollmentMethods: this.availableEnrollmentMethods,
	    availableAuthenticationMethods: this.availableAuthenticationMethods
	  };
	
	  data.enrollments = object.map(this.enrollments, enrollmentSerialize);
	
	  data.enrollmentAttempt = this.enrollmentAttempt
	    ? this.enrollmentAttempt.serialize() : undefined;
	  data.authVerificationStep = self.authVerificationStep
	    ? self.authVerificationStep.serialize() : null;
	  data.enrollmentConfirmationStep = self.enrollmentConfirmationStep
	    ? self.enrollmentConfirmationStep.serialize() : null;
	
	  return data;
	};
	
	
	transaction.prototype.getState = function getState(callback) {
	  var self = this;
	
	  return self.httpClient.post('/api/transaction-state',
	    self.transactionToken,
	    null,
	    callback);
	};
	
	/**
	 * @public
	 *
	 * Start an enrollment on this transaction
	 */
	transaction.prototype.enroll = function enroll(method, data, callback) {
	  var self = this;
	
	  if (self.isEnrolled()) {
	    asyncHelpers.setImmediate(callback, new errors.AlreadyEnrolledError());
	    return;
	  }
	
	  if (object.get(self, 'availableEnrollmentMethods', []).length === 0) {
	    asyncHelpers.setImmediate(callback, new errors.NoMethodAvailableError());
	    return;
	  }
	
	  if (!object.contains(self.availableEnrollmentMethods, method)) {
	    asyncHelpers.setImmediate(callback, new errors.EnrollmentMethodDisabledError(method));
	    return;
	  }
	
	  var strategy = self.enrollmentStrategies[method];
	
	  if (!strategy) {
	    asyncHelpers.setImmediate(callback, new errors.MethodNotFoundError(method));
	    return;
	  }
	
	  self.enrollmentAttempt.setActive(true);
	  self.eventSequencer.addSequence('local-enrollment', ['enrollment-complete', 'auth-response']);
	
	  strategy.enroll(data, function onEnrollmentStarted(err) {
	    if (err) {
	      self.dismissEnrollmentAttempt();
	
	      callback(err);
	      return;
	    }
	
	    var confirmationStep = enrollmentConfirmationStep({
	      strategy: strategy,
	      transaction: self,
	      enrollmentCompleteHub: self.enrollmentCompleteHub,
	      enrollmentAttempt: self.enrollmentAttempt
	    });
	
	    self.enrollmentConfirmationStep = confirmationStep;
	
	    confirmationStep.once('enrollment-complete', function onEnrollmentComplete(payload) {
	      self.addEnrollment(payload.enrollment);
	      self.eventSequencer.emit('enrollment-complete', payload);
	
	      self.dismissEnrollmentAttempt();
	    });
	
	    confirmationStep.on('error', function onError(iErr) {
	      self.dismissEnrollmentAttempt();
	
	      self.eventSequencer.emit('error', iErr);
	    });
	
	    callback(null, confirmationStep);
	    return;
	  });
	};
	
	/**
	 * @public
	 *
	 * Starts authentication process
	 *
	 * @param {Enrollment} enrollment
	 * @param {sms|otp|push} options.method
	 */
	transaction.prototype.requestAuth = function requestAuth(enrollment, options, callback) {
	  if (arguments.length === 2) {
	    callback = options; // eslint-disable-line no-param-reassign
	    options = {}; // eslint-disable-line no-param-reassign
	  }
	
	  options = options || {}; // eslint-disable-line no-param-reassign
	
	  if (!this.isEnrolled()) {
	    asyncHelpers.setImmediate(callback, new errors.NotEnrolledError());
	    return;
	  }
	
	  if (!enrollment) {
	    asyncHelpers.setImmediate(callback, new errors.InvalidEnrollmentError());
	    return;
	  }
	
	  var availableMethods = enrollment.getAvailableMethods();
	
	  if (!availableMethods) {
	    asyncHelpers.setImmediate(callback, new errors.InvalidEnrollmentError());
	    return;
	  }
	
	  if (!options.method) {
	    options.method = availableMethods[0]; // eslint-disable-line no-param-reassign
	  }
	
	  if (object.get(this, 'availableAuthenticationMethods', []).length === 0) {
	    asyncHelpers.setImmediate(callback, new errors.NoMethodAvailableError());
	    return;
	  }
	
	  if (!object.contains(this.availableAuthenticationMethods, options.method)) {
	    asyncHelpers.setImmediate(callback, new errors.AuthMethodDisabledError(options.method));
	    return;
	  }
	
	  var strategy = this.authStrategies[options.method];
	
	  if (!strategy) {
	    asyncHelpers.setImmediate(callback, new errors.MethodNotFoundError(options.method));
	    return;
	  }
	
	  this.removeAuthListeners();
	  this.requestStrategyAuth(strategy, callback);
	};
	
	/**
	 * @public
	 *
	 * Authenticate using recovery code
	 *
	 * @param {string} data.recoveryCode
	 */
	transaction.prototype.recover = function recover(data, cb) {
	  var self = this;
	
	  if (!this.isEnrolled()) {
	    asyncHelpers.setImmediate(events.emitErrorOrCallback,
	      new errors.NotEnrolledError(), self.eventSequencer, cb);
	    return;
	  }
	
	  self.requestStrategyAuth(self.authRecoveryStrategy,
	    function onRecoveryRequested(err, recoveryAuth) {
	      if (err) {
	        events.emitErrorOrCallback(err, self.eventSequencer, cb);
	        return;
	      }
	
	      recoveryAuth.verify(data, cb);
	    });
	};
	
	/**
	 * @public
	 *
	 * @returns {boolean} whether there is at least one enrollment
	 */
	transaction.prototype.isEnrolled = function isEnrolled() {
	  return this.enrollments.length > 0;
	};
	
	/**
	 * @public
	 *
	 * @returns {array.<Enrollment>} enrollments
	 */
	transaction.prototype.getEnrollments = function getEnrollments() {
	  return this.enrollments;
	};
	
	/**
	 * @public
	 */
	transaction.prototype.getAvailableEnrollmentMethods = function getAvailableEnrollmentMethods() {
	  return this.availableEnrollmentMethods;
	};
	
	/**
	 * @private
	 */
	transaction.prototype.dismissEnrollmentAttempt = function dismissEnrollmentAttempt() {
	  var self = this;
	
	  self.eventSequencer.removeSequence('local-enrollment');
	  self.enrollmentAttempt.setActive(false);
	};
	
	/**
	 * @private
	 */
	transaction.prototype.addEnrollment = function addEnrollment(enrollment) {
	  this.enrollments.push(enrollment);
	};
	
	/**
	 * @private
	 */
	transaction.prototype.removeAuthListeners = function removeAuthListeners() {
	  var self = this;
	
	  self.loginCompleteHub.removeAllListeners();
	  self.loginRejectedHub.removeAllListeners();
	};
	
	/**
	 * @private
	 *
	 * @returns {array.<string>}
	 */
	transaction.prototype.getAvailableAuthenticationMethods
	  = function getAvailableAuthenticationMethods() {
	    return this.availableAuthenticationMethods;
	  };
	
	/**
	 * @private
	 *
	 * @param {AuthStrategy} strategy
	 * @param {EventEmitter} options.loginCompleteHub
	 * @param {EventEmitter} options.loginRejectedHub
	 */
	transaction.prototype.requestStrategyAuth = function requestStrategyAuth(strategy, callback) {
	  var self = this;
	
	  strategy.request(function onAuthRequested(err) {
	    if (err) {
	      callback(err);
	      return;
	    }
	
	    var verificationStep = authVerificationStep(strategy, {
	      loginCompleteHub: self.loginCompleteHub,
	      loginRejectedHub: self.loginRejectedHub
	    });
	
	    verificationStep.once('auth-response', function onAuthResponse(payload) {
	      self.eventSequencer.emit('auth-response', payload);
	    });
	
	    verificationStep.on('error', function onError(error) {
	      self.eventSequencer.emit('error', error);
	    });
	
	    self.authVerificationStep = verificationStep;
	
	    callback(null, verificationStep);
	  });
	};
	
	transaction.prototype.getAuthVerificationStep = function getAuthVerificationStep() {
	  var self = this;
	
	  if (!self.authVerificationStep) {
	    throw new errors.InvalidStateError('Cannot get enrollment confirmation ' +
	    'step, you must call .requestAuth first');
	  }
	
	  return self.authVerificationStep;
	};
	
	transaction.prototype.getEnrollmentConfirmationStep = function getEnrollmentConfirmationStep() {
	  var self = this;
	
	  if (!self.enrollmentConfirmationStep) {
	    throw new errors.InvalidStateError('Cannot get enrollment confirmation step, ' +
	    'you must call .enroll first');
	  }
	
	  return self.enrollmentConfirmationStep;
	};
	
	module.exports = transaction;


/***/ }),
/* 51 */
/***/ (function(module, exports) {

	'use strict';
	
	/**
	 * Builds authentication completion payload
	 *
	 * @param {boolean} accepted if the auth was accepted
	 * @param {string} signature auth token to send to the server to verify the authentication
	 */
	exports.buildAuthCompletionPayload = function buildAuthCompletionPayload(accepted, signature) {
	  return {
	    accepted: accepted,
	    signature: signature
	  };
	};
	
	/**
	 * @param {object} options.apiPayload
	 * @param {string} options.method
	 * @param {EnrollmentAttempt} options.enrollmentAttempt
	 * @param {Enrollment} options.enrollment new enrollment
	 */
	exports.buildEnrollmentCompletePayload = function buildEnrollmentCompletePayload(options) {
	  var apiPayload = options.apiPayload;
	  var method = options.method;
	  var enrollmentAttempt = options.enrollmentAttempt;
	  var txId = options.txId;
	
	  var payload = {
	    enrollment: options.enrollment
	  };
	
	  if (enrollmentAttempt && apiPayload.txId === txId) {
	    // Belongs to this transaction
	    payload.recoveryCode = enrollmentAttempt.getRecoveryCode();
	    payload.authRequired = enrollmentAttempt.isAuthRequired(method);
	  } else {
	    payload.recoveryCode = null;
	
	    // Enrollment was not made from this transaction which means
	    // you will have to login to continue
	    payload.authRequired = true;
	  }
	
	  return payload;
	};


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	var helpers = __webpack_require__(51);
	var events = __webpack_require__(53);
	
	function authVerificationStep(strategy, options) {
	  var self = object.create(authVerificationStep.prototype);
	  EventEmitter.call(self);
	
	  self.strategy = strategy;
	  self.transaction = options.transaction;
	  self.loginCompleteHub = options.loginCompleteHub;
	  self.loginRejectedHub = options.loginRejectedHub;
	
	  return self;
	}
	
	authVerificationStep.prototype = object.create(EventEmitter.prototype);
	
	/**
	 * Returns method associated with current auth flow
	 *
	 * @returns {sms|otp|push}
	 */
	authVerificationStep.prototype.getMethod = function getMethod() {
	  return this.strategy.method;
	};
	
	/**
	 * @param {object} data
	 * @param {function} [acceptedCallback] Triggered once the data has been
	 * accepted by the service provider, the first arguments indicates if it
	 * was valid
	 */
	authVerificationStep.prototype.verify = function verify(data, acceptedCallback) {
	  var self = this;
	
	  // TODO Move this to the transaction
	  self.loginCompleteHub.removeAllListeners();
	  self.loginRejectedHub.removeAllListeners();
	
	  var listenLoginCompleteTask = function listenLoginCompleteTask(done) {
	    self.loginCompleteHub.listenOnce(function onLoginComplete(completionPayload) {
	      done(null, helpers.buildAuthCompletionPayload(true, completionPayload.signature));
	    });
	  };
	
	  var listenLoginRejectedTask = function listenLoginRejectedTask(done) {
	    self.loginRejectedHub.listenOnce(function onLoginRejected() {
	      done(null, helpers.buildAuthCompletionPayload(false, null));
	    });
	  };
	
	  var loginOrRejectTask = function loginOrRejectTask(done) {
	    asyncHelpers.any([listenLoginCompleteTask, listenLoginRejectedTask], done);
	  };
	
	  var verifyAuthTask = function verifyAuthTask(done) {
	    self.strategy.verify(data, function onVerified(err, verificationPayload) {
	      // eslint-disable-next-line no-param-reassign
	      verificationPayload = verificationPayload || {};
	
	      if (err) {
	        done(err);
	        return;
	      }
	
	      var payload = {
	        // New recovery code if needed (recover)
	        recoveryCode: verificationPayload.recoveryCode
	      };
	
	      // On the one hand we trigger the callback since the data has been
	      // accepted by the service provider, on the other hand
	      // we still need to wait for (loginOrRejectTask) to trigger the event.
	      // loginOrRejectTask might never be triggered in case of transport=manual
	      if (acceptedCallback) { acceptedCallback(null, payload); }
	
	      done(null, payload);
	    });
	  };
	
	  // This function takes care of the possible difference on arrival because
	  // of the difference on transportation layer, it is perfectly possible
	  // for completion event to arrive BEFORE the http call response
	  asyncHelpers.all([
	    loginOrRejectTask,
	    verifyAuthTask
	  ], function onCompletion(err, payloads) {
	    // TODO Move this to the transaction
	    self.loginCompleteHub.removeAllListeners();
	    self.loginRejectedHub.removeAllListeners();
	
	    if (err) {
	      events.emitErrorOrCallback(err, self, acceptedCallback);
	      return;
	    }
	
	    self.emit('auth-response', object.assign.apply(object, payloads));
	  });
	};
	
	authVerificationStep.prototype.serialize = function serialize() {
	  var self = this;
	
	  return { method: self.getMethod() };
	};
	
	module.exports = authVerificationStep;


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * Executes the state handler for the particular event and
	 * removes the listener for that event and all the other ones
	 *
	 * @param {EventEmitter} emitter
	 * @param {object} handlers event handlers format { [eventName]: [function(payload) { }] }
	 */
	exports.onceAny = function onceAny(emitter, handlers) {
	  return (function onceAnyBuilder() {
	    var listeners = {};
	
	    var removeAllListeners = function removeAllListeners() {
	      object.forEach(listeners, function removeListener(removalWrapper, removalEventName) {
	        emitter.removeListener(removalEventName, removalWrapper);
	      });
	    };
	
	    object.forEach(handlers, function handlersIterator(handler, eventName) {
	      var wrapper = function handlerWrapper(payload) {
	        removeAllListeners();
	
	        handler.call(null, payload);
	      };
	
	      listeners[eventName] = wrapper;
	
	      emitter.once(eventName, wrapper);
	    });
	
	    return { cancel: removeAllListeners };
	  }());
	};
	
	exports.ignoreError = function ignoreError(emitter, error) {
	  var handler = function handler(err) {
	    // If it is the error we are waiting for we don't need to do anything,
	    // just ignore it, the other handled will also be called to handle the
	    // error (if any)
	    if (err === error) {
	      return;
	    }
	
	    // If it is not the expected error but other, and there is nobody else
	    // to handle it let's remove the handler and re-emit it causing
	    // an uncaught as expected in such case
	    emitter.off('error', handler);
	
	    if (emitter.listenerCount('error') === 0) {
	      emitter.emit('error', error);
	    }
	  };
	
	  // If there are other handlers we don't need to do anything, the other
	  // handlers will take care of the error
	  if (emitter.listenerCount('error') === 0) {
	    emitter.once('error', handler);
	  }
	};
	
	exports.emitErrorOrCallback = function emitErrorOrCallback(err, emitter, cb) {
	  if (!cb) {
	    emitter.emit('error', err);
	    return;
	  }
	
	  cb(err);
	};


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var events = __webpack_require__(53);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	var enrollmentBuilder = __webpack_require__(49);
	var helpers = __webpack_require__(51);
	
	/**
	 * @param {EnrollmentStrategy} options.strategy
	 * @param {EnrollmentAttempt} options.enrollmentAttempt
	 * @param {EventEmitter} options.enrollmentCompleteHub
	 */
	function enrollmentConfirmationStep(options) {
	  var self = object.create(enrollmentConfirmationStep.prototype);
	  EventEmitter.call(self);
	
	  self.strategy = options.strategy;
	  self.transaction = options.transaction;
	  self.enrollmentAttempt = options.enrollmentAttempt;
	  self.enrollmentCompleteHub = options.enrollmentCompleteHub;
	
	  return self;
	}
	
	enrollmentConfirmationStep.prototype = object.create(EventEmitter.prototype);
	
	enrollmentConfirmationStep.prototype.getUri = function getUri() {
	  return this.strategy.getUri();
	};
	
	enrollmentConfirmationStep.prototype.getData = function getData() {
	  return this.strategy.getData();
	};
	
	enrollmentConfirmationStep.prototype.getMethod = function getMethod() {
	  return this.strategy.method;
	};
	
	/**
	 * @param {object} data
	 * @param {function} [acceptedCallback] Triggered once the data has been accepted by
	 * the service provider, the first argument indicates if it was valid
	 */
	enrollmentConfirmationStep.prototype.confirm = function confirm(data, acceptedCallback) {
	  var self = this;
	
	  // TODO Move this to the transaction
	  self.enrollmentCompleteHub.removeAllListeners();
	
	  var listenToEnrollmentCompleteTask = function listenToEnrollmentCompleteTask(done) {
	    self.enrollmentCompleteHub.listenOnce(function onEnrollmentComplete(payload) {
	      done(null, payload);
	    });
	  };
	
	  var confirmTask = function confirmTask(done) {
	    self.strategy.confirm(data, function confirmationDataAccepted(err, result) {
	      if (err) {
	        if (acceptedCallback) {
	          events.ignoreError(self, err);
	
	          acceptedCallback(err);
	        }
	
	        done(err);
	        return;
	      }
	
	      if (acceptedCallback) {
	        acceptedCallback(err, { recoveryCode: self.enrollmentAttempt.getRecoveryCode() });
	      }
	
	      done(err, result);
	    });
	  };
	
	  asyncHelpers.all([
	    listenToEnrollmentCompleteTask,
	    confirmTask
	  ], function onAllComplete(err, results) {
	    // TODO Move this to the transaction
	    self.enrollmentCompleteHub.removeAllListeners();
	
	    if (err) {
	      self.emit('error', err);
	      return;
	    }
	
	    var apiPayload = results[0];
	
	    var payload = helpers.buildEnrollmentCompletePayload({
	      txId: self.transaction.txId,
	      apiPayload: apiPayload,
	      method: self.strategy.method,
	      enrollmentAttempt: self.enrollmentAttempt,
	      enrollment: enrollmentBuilder(apiPayload.deviceAccount)
	    });
	
	    self.emit('enrollment-complete', payload);
	  });
	};
	
	enrollmentConfirmationStep.prototype.serialize = function serialize() {
	  var self = this;
	
	  return { method: self.getMethod() };
	};
	
	module.exports = enrollmentConfirmationStep;


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var errors = __webpack_require__(8);
	var object = __webpack_require__(3);
	var validations = __webpack_require__(56);
	var asyncHelpers = __webpack_require__(4);
	
	/**
	 * @param {JWTToken} data.transactionToken
	 * @param {HttpClient} options.httpClient
	 */
	function recoveryAuthenticatorStrategy(data, options) {
	  var self = object.create(recoveryAuthenticatorStrategy.prototype);
	
	  self.method = null;
	
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	recoveryAuthenticatorStrategy.prototype.request = function request(callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	/**
	 * Account login using recovery code
	 *
	 * @param {string} data.recoveryCode
	 */
	recoveryAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
	  if (!data || !data.recoveryCode) {
	    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('recoveryCode'));
	    return;
	  }
	
	  if (!validations.validateRecoveryCode(data.recoveryCode)) {
	    asyncHelpers.setImmediate(callback, new errors.RecoveryCodeValidationError());
	    return;
	  }
	
	  this.httpClient.post(
	    'api/recover-account',
	    this.transactionToken,
	    { recovery_code: data.recoveryCode },
	    callback);
	};
	
	module.exports = recoveryAuthenticatorStrategy;


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	/**
	 * Common validations
	 */
	
	var object = __webpack_require__(3);
	
	var OTP_LENGTH = 6;
	var RECOVERY_CODE_LENGTH = 24;
	
	/**
	 * @param {string} iotp One time password
	 *
	 * @returns {boolean} true if otp is a valid otp, false otherwise
	 */
	exports.validateOtp = function validateOtp(iotp) {
	  var otp = iotp && iotp.toString();
	
	  return object.isIntegerString(otp) && otp.length === OTP_LENGTH;
	};
	
	/**
	 * @param {string} irecovery Recovery code
	 *
	 * @returns {boolean} true if recovery is a valid recovery code (regarding format),
	 * false otherwise
	 */
	exports.validateRecoveryCode = function validateRecovery(irecovery) {
	  var recovery = irecovery && irecovery.toString();
	
	  return recovery && object.isAlphaNumeric(recovery) && recovery.length === RECOVERY_CODE_LENGTH;
	};


/***/ }),
/* 57 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var url = __webpack_require__(39);
	var object = __webpack_require__(3);
	var errors = __webpack_require__(8);
	var asyncHelpers = __webpack_require__(4);
	var validations = __webpack_require__(56);
	
	/**
	 * @param {HttpClient} options.httpClient
	 * @param {JWTToken} data.transactionToken
	 * @param {EnrollmentAttempt} data.enrollmentAttempt
	 */
	function smsEnrollmentStrategy(data, options) {
	  var self = object.create(smsEnrollmentStrategy.prototype);
	
	  self.method = 'sms';
	  self.enrollmentAttempt = data.enrollmentAttempt;
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	/**
	 * Starts sms enrollment
	 *
	 * @public
	 * @param {string} data.phoneNumber
	 */
	smsEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
	  if (!data.phoneNumber) {
	    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('phoneNumber'));
	    return;
	  }
	
	  this.httpClient.post(
	    url.join('api/device-accounts',
	      encodeURIComponent(this.enrollmentAttempt.getEnrollmentId()), '/sms-enroll'),
	    this.transactionToken,
	    { phone_number: data.phoneNumber },
	    callback);
	};
	
	/**
	 * Confirms the enrollment
	 *
	 * @public
	 * @param {string} data.otpCode
	 */
	smsEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
	  if (!data.otpCode) {
	    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
	    return;
	  }
	
	  if (!validations.validateOtp(data.otpCode)) {
	    asyncHelpers.setImmediate(callback, new errors.OTPValidationError());
	    return;
	  }
	
	  this.httpClient.post(
	    'api/verify-otp',
	    this.transactionToken, {
	      type: 'manual_input',
	      code: data.otpCode
	    },
	    callback);
	};
	
	/**
	 * NOOP (returns null) just to keep public API consistent
	 */
	smsEnrollmentStrategy.prototype.getUri = function getUri() {
	  return null;
	};
	
	smsEnrollmentStrategy.prototype.getData = function getData() {
	  return null;
	};
	
	module.exports = smsEnrollmentStrategy;


/***/ }),
/* 58 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var enrollmentUriHelper = __webpack_require__(59);
	
	/**
	 * @param {HttpClient} options.httpClient
	 * @param {JWTToken} data.transactionToken
	 * @param {EnrollmentAttempt} data.enrollmentAttempt
	 * @param {{ name, label }} data.issuer
	 */
	function pnEnrollmentStrategy(data, options) {
	  var self = object.create(pnEnrollmentStrategy.prototype);
	
	  self.method = 'push';
	  self.enrollmentAttempt = data.enrollmentAttempt;
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	/**
	 * NOOP Method, just to keep a consistent public API
	 *
	 * @public
	 */
	pnEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	/**
	 * Confirms the enrollment
	 *
	 * @public
	 * @param {string} data.otpCode
	 */
	pnEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	/**
	 * Returns URI for authenticator / otp enrollment
	 *
	 * @public
	 * @returns {string}
	 */
	pnEnrollmentStrategy.prototype.getUri = function getUri() {
	  return enrollmentUriHelper(this.getData());
	};
	
	pnEnrollmentStrategy.prototype.getData = function getData() {
	  return {
	    issuerLabel: this.enrollmentAttempt.getIssuerLabel(),
	    otpSecret: this.enrollmentAttempt.getOtpSecret(),
	    enrollmentTransactionId: this.enrollmentAttempt.getEnrollmentTransactionId(),
	    issuerName: this.enrollmentAttempt.getIssuerName(),
	    enrollmentId: this.enrollmentAttempt.getEnrollmentId(),
	    baseUrl: this.enrollmentAttempt.getBaseUri(),
	    accountLabel: this.enrollmentAttempt.getAccountLabel(),
	    algorithm: 'sha1',
	    digits: 6,
	    counter: 0,
	    period: 30
	  };
	};
	
	module.exports = pnEnrollmentStrategy;


/***/ }),
/* 59 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var url = __webpack_require__(40);
	
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
	
	  var pathname;
	  if (data.accountLabel) {
	    pathname = encodeURIComponent(data.issuerName) + ':' + encodeURIComponent(data.accountLabel);
	  } else {
	    pathname = encodeURIComponent(data.issuerName);
	  }
	
	  return url.format({
	    protocol: 'otpauth:',
	    host: '//totp/',
	    pathname: pathname,
	    query: query
	  });
	};


/***/ }),
/* 60 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var errors = __webpack_require__(8);
	var validations = __webpack_require__(56);
	var enrollmentUriHelper = __webpack_require__(59);
	
	/**
	 * @param {HttpClient} options.httpClient
	 * @param {JWTToken} data.transactionToken
	 * @param {EnrollmentAttempt} data.enrollmentAttempt
	 */
	function authenticatorEnrollmentStrategy(data, options) {
	  var self = object.create(authenticatorEnrollmentStrategy.prototype);
	
	  self.method = 'otp';
	  self.enrollmentAttempt = data.enrollmentAttempt;
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	/**
	 * NOOP Method, just to keep a consistent public API
	 *
	 * @public
	 */
	authenticatorEnrollmentStrategy.prototype.enroll = function enroll(data, callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	/**
	 * Confirms the enrollment
	 *
	 * @public
	 * @param {string} data.otpCode
	 */
	authenticatorEnrollmentStrategy.prototype.confirm = function confirm(data, callback) {
	  if (!data.otpCode) {
	    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
	    return;
	  }
	
	  if (!validations.validateOtp(data.otpCode)) {
	    asyncHelpers.setImmediate(callback, new errors.OTPValidationError());
	    return;
	  }
	
	  this.httpClient.post(
	    'api/verify-otp',
	    this.transactionToken, {
	      type: 'manual_input',
	      code: data.otpCode
	    },
	    callback);
	};
	
	/**
	 * Returns URI for authenticator / otp enrollment
	 *
	 * @public
	 * @returns {string}
	 */
	authenticatorEnrollmentStrategy.prototype.getUri = function getUri() {
	  return enrollmentUriHelper(this.getData());
	};
	
	authenticatorEnrollmentStrategy.prototype.getData = function getData() {
	  return {
	    issuerName: this.enrollmentAttempt.getIssuerName(),
	    otpSecret: this.enrollmentAttempt.getOtpSecret(),
	    accountLabel: this.enrollmentAttempt.getAccountLabel()
	  };
	};
	
	module.exports = authenticatorEnrollmentStrategy;


/***/ }),
/* 61 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var otpAuthenticatorStrategy = __webpack_require__(62);
	
	/**
	 * @param {JWTToken} data.transactionToken
	 * @param {HttpClient} options.httpClient
	 */
	function smsAuthenticatorStrategy(data, options) {
	  var self = object.create(smsAuthenticatorStrategy.prototype);
	
	  self.method = 'sms';
	
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  self.otpAuthenticatorStrategy = otpAuthenticatorStrategy({
	    transactionToken: data.transactionToken,
	    method: self.method
	  }, {
	    httpClient: self.httpClient
	  });
	
	  return self;
	}
	
	smsAuthenticatorStrategy.prototype.request = function request(callback) {
	  this.httpClient.post('api/send-sms', this.transactionToken, null, callback);
	};
	
	smsAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
	  this.otpAuthenticatorStrategy.verify(data, callback);
	};
	
	module.exports = smsAuthenticatorStrategy;


/***/ }),
/* 62 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var errors = __webpack_require__(8);
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	var validations = __webpack_require__(56);
	
	/**
	 * @param {JWTToken} data.transactionToken
	 * @param {HttpClient} options.httpClient
	 */
	function otpAuthenticatorStrategy(data, options) {
	  var self = object.create(otpAuthenticatorStrategy.prototype);
	
	  self.method = data.method || 'otp';
	
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	otpAuthenticatorStrategy.prototype.request = function request(callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	otpAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
	  if (!data || !data.otpCode) {
	    asyncHelpers.setImmediate(callback, new errors.FieldRequiredError('otpCode'));
	    return;
	  }
	
	  if (!validations.validateOtp(data.otpCode)) {
	    asyncHelpers.setImmediate(callback, new errors.OTPValidationError());
	    return;
	  }
	
	  this.httpClient.post(
	    'api/verify-otp',
	    this.transactionToken, {
	      type: 'manual_input',
	      code: data.otpCode
	    },
	    callback);
	};
	
	module.exports = otpAuthenticatorStrategy;


/***/ }),
/* 63 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	
	/**
	 * @param {JWTToken} data.transactionToken
	 * @param {HttpClient} options.httpClient
	 */
	function pnAuthenticatorStrategy(data, options) {
	  var self = object.create(pnAuthenticatorStrategy.prototype);
	
	  self.method = 'push';
	
	  self.transactionToken = data.transactionToken;
	  self.httpClient = options.httpClient;
	
	  return self;
	}
	
	/**
	 * Request login authorization (push notification). So it a request for the
	 * push notification
	 *
	 * @public
	 */
	pnAuthenticatorStrategy.prototype.request = function request(callback) {
	  this.httpClient.post(
	    'api/send-push-notification',
	    this.transactionToken,
	    null,
	    callback);
	};
	
	/**
	 * NOOP just to keep a consistent public API
	 *
	 * @public
	 */
	pnAuthenticatorStrategy.prototype.verify = function verify(data, callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	module.exports = pnAuthenticatorStrategy;


/***/ }),
/* 64 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	
	/**
	 * Controls the sequence of events, accepts events in any sequence and re-emits
	 * them in the right sequence once it gets all the events in the sequence.
	 * If no sequence is defined the event is re-emitted immediatelly.
	 *
	 * Useful to abstract transport layer timming issues and garantee a given
	 * event sequence
	 *
	 * Assumed that there is a single event of each time on each the sequence
	 * The sequences are assumed to be compatible, that is to say the sequence of
	 * shared events must be the same in every sequence
	 */
	function eventSequencer() {
	  var self = object.create(eventSequencer.prototype);
	  EventEmitter.call(self);
	
	  self.sequences = {};
	  self.received = {};
	
	  self.pipedEmitter = null;
	
	  return self;
	}
	
	eventSequencer.prototype = object.create(EventEmitter.prototype);
	
	eventSequencer.prototype.emit = function emit(eventName, payload) {
	  var self = this;
	  var sequences = this.getSequencesWithEvent(eventName);
	
	  self.received[eventName] = { emitted: false, payload: payload };
	
	  self.applySequences(sequences);
	
	  // The event might not have been in any sequense, let's send it
	  // right away then
	  if (self.canEmitEventForSequences(sequences, eventName)) {
	    self.doActualEmit(eventName);
	  }
	};
	
	eventSequencer.prototype.applySequences = function applySequences(sequences) {
	  var self = this;
	
	  // This could be optimized if needed, but the expected sequences are just a few
	  // and very short
	  object.forEach(sequences, function controlledEmitter(sequence) {
	    object.forEach(sequence, function emitTrial(seqEventName) {
	      var eventSequences = self.getSequencesWithEvent(seqEventName);
	      if (!self.canEmitEventForSequences(eventSequences, seqEventName)) {
	        // We can not emit this event so we cannot emit following in the sequece
	        // lets stop
	        return false;
	      }
	
	      self.doActualEmit(seqEventName);
	      return true;
	    });
	  });
	};
	
	eventSequencer.prototype.doActualEmit = function doActualEmit(eventName) {
	  var self = this;
	  var payload = self.received[eventName].payload;
	  self.received[eventName].emitted = true;
	
	  if (self.pipedEmitter) {
	    self.pipedEmitter.emit(eventName, payload);
	  }
	
	  EventEmitter.prototype.emit.call(self, eventName, payload);
	};
	
	eventSequencer.prototype.canEmitEventForSequences =
	  function canEmitEventForSequences(sequences, eventName) {
	    var self = this;
	
	    if (sequences.length === 0) {
	      return true;
	    }
	
	    return object.every(sequences, function prevChecker(sequece) {
	      return !self.haveToEmitOtherEventsBefore(sequece, eventName) &&
	        self.canBeEmittedNow(eventName);
	    });
	  };
	
	eventSequencer.prototype.haveToEmitOtherEventsBefore =
	  function haveToEmitOtherEventsBefore(sequence, comparisonEventName) {
	    var self = this;
	    var comparisonEventIndex = sequence.indexOf(comparisonEventName);
	
	    var isThereSomeNonEmittedPreviousEvent = false;
	    object.forEach(sequence, function pendingFinder(eventName, index) {
	      if (index >= comparisonEventIndex) {
	      // Stop search
	        return false;
	      }
	
	      if (!self.received[eventName] || !self.received[eventName].emitted) {
	        isThereSomeNonEmittedPreviousEvent = true;
	      // Stop search
	        return false;
	      }
	
	    // Continue
	      return true;
	    });
	
	    return isThereSomeNonEmittedPreviousEvent;
	  };
	
	eventSequencer.prototype.canBeEmittedNow = function canBeEmittedNow(eventName) {
	  return this.received[eventName] && !this.received[eventName].emitted;
	};
	
	eventSequencer.prototype.getSequencesWithEvent = function getSequencesWithEvent(eventName) {
	  var self = this;
	
	  return object.filter(self.sequences, function sequenceFilter(seq) {
	    return object.contains(seq, eventName);
	  });
	};
	
	eventSequencer.prototype.addSequence = function addSequence(name, sequence) {
	  this.sequences[name] = sequence;
	};
	
	eventSequencer.prototype.removeSequence = function removeSequence(name) {
	  var self = this;
	  var deletedSequence = this.sequences[name] || [];
	
	  delete this.sequences[name];
	
	  // Emit events that have been unblocked by deletion but that aren't in any
	  // other sequence
	  object.forEach(deletedSequence, function emitUnblocked(eventName) {
	    if (Object.keys(self.sequences).length > 0 &&
	      self.canEmitEventForSequences(self.sequences, eventName)) {
	      self.doActualEmit(eventName);
	    }
	  });
	
	  this.applySequences(this.sequences);
	};
	
	eventSequencer.prototype.pipe = function pipe(emitter) {
	  var self = this;
	
	  // Avoid failing with uncaught when there is a piped emitter
	  self.on('error', function onError(err) {
	    // In case it has been removed or so
	    if (!self.pipedEmitter) {
	      setTimeout(function throwError() { throw err; });
	    }
	  });
	
	  this.pipedEmitter = emitter;
	};
	
	module.exports = eventSequencer;


/***/ }),
/* 65 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * A hub keeps track of an event and its listeners on a particular context and
	 * is able to manage them on that context
	 *
	 * @param {EventEmitter} emitter
	 * @param {string} eventName
	 */
	function eventListenerHub(emitter, eventName) {
	  var self = object.create(eventListenerHub.prototype);
	
	  self.emitter = emitter;
	  self.eventName = eventName;
	  self.handlers = [];
	  self.defaultHandlerFn = null;
	
	  return self;
	}
	
	eventListenerHub.prototype.listen = function listen(handler) {
	  this.handlers.push(handler);
	  this.emitter.on(this.eventName, handler);
	};
	
	eventListenerHub.prototype.listenOnce = function listenOnce(handler) {
	  this.handlers.push(handler);
	  this.emitter.once(this.eventName, handler);
	};
	
	/**
	 * Default action if there are no other handlers listening on the hub
	 */
	eventListenerHub.prototype.defaultHandler = function defaultHandler(handler) {
	  var self = this;
	
	  if (self.defaultHandlerFn) {
	    return;
	  }
	
	  self.defaultHandlerFn = handler;
	
	  this.emitter.on(this.eventName, function defaultListener(payload) {
	    if (!self.defaultHandlerFn) {
	      return;
	    }
	
	    if (self.handlers.length === 0) {
	      self.defaultHandlerFn(payload);
	    }
	  });
	};
	
	eventListenerHub.prototype.removeAllListeners = function removeAllListeners() {
	  var self = this;
	
	  object.forEach(self.handlers, function handlerRemoval(handler) {
	    self.emitter.removeListener(self.eventName, handler);
	  });
	
	  self.handlers = [];
	};
	
	module.exports = eventListenerHub;


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

	var polling = __webpack_require__(67);
	var socketio = __webpack_require__(68);
	var nullClient = __webpack_require__(114);
	
	exports.create = function create(options) {
	  var serviceUrl = options.serviceUrl;
	  var transport = options.transport;
	  var httpClient = options.httpClient;
	  var dependency = options.dependency;
	
	  if (dependency) {
	    return dependency;
	  }
	
	  if (transport === 'polling') {
	    return polling(serviceUrl, { httpClient: httpClient });
	  } else if (transport === 'manual') {
	    return nullClient();
	  }
	
	  // default socket
	  return socketio(serviceUrl);
	};


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var url = __webpack_require__(39);
	var object = __webpack_require__(3);
	var EventEmitter = __webpack_require__(28).EventEmitter;
	var httpClient = __webpack_require__(30);
	
	var DEFAULT_POLLING_INTERVAL_MS = 5000;
	var MIN_POLLING_INTERVAL_MS = 2000;
	var DEFAULT_TIME_SHIFT_TOLERANCE_FACTOR = 0.2;
	
	/**
	 * @implements SocketClient
	 * @param {HttpClient} options.httpClient
	 */
	function pollingClient(urlBase, options) {
	  options = options || {}; // eslint-disable-line no-param-reassign
	
	  var self = object.create(pollingClient.prototype);
	
	  self.httpClient = options.httpClient || httpClient(urlBase);
	
	  if (object.isObject(urlBase)) {
	    urlBase = url.format(urlBase); // eslint-disable-line no-param-reassign
	  }
	
	  self.hub = new EventEmitter();
	
	  self.state = null;
	  self.limits = {
	    limit: null,
	    remaining: null,
	    reset: null
	  };
	
	  self.defaultPollingIntervalMs = options.pollingIntervalMs || DEFAULT_POLLING_INTERVAL_MS;
	  self.minPollingIntervalMs = options.minPollingIntervalMs || MIN_POLLING_INTERVAL_MS;
	
	  return self;
	}
	
	pollingClient.prototype.pollStateOnce = function pollStateOnce(token, callback) {
	  var self = this;
	
	  self.httpClient.post('/api/transaction-state', token, null, { completeResponse: true },
	     function onResponse(err, response) {
	       if (err) {
	         if (callback) {
	           callback(err);
	         } else {
	           self.handleErrors(err);
	         }
	
	         return;
	       }
	
	       self.limits = self.getLimits(response);
	
	       self.emitEvents(null, self.state, response.body);
	
	       self.state = response.body;
	
	       if (callback) {
	         callback(null, response.body);
	       }
	     });
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.getLimits = function getLimits(response) {
	  return {
	    limit: response.headers['X-RateLimit-Limit'],
	    remaining: response.headers['X-RateLimit-Remaining'],
	    reset: response.headers['X-RateLimit-Reset']
	  };
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.handleErrors = function handleErrors(err) {
	  if (err.response && err.response.statusCode === 429) {
	    this.handleRateLimit(err);
	  } else {
	    this.emitEvents(err);
	  }
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.handleRateLimit = function handleRateLimit(err) {
	  var self = this;
	
	  self.closeConnection();
	  self.limits = self.getLimits(err.response);
	
	  self.intervalPoll();
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.calcPollingInterval = function calcPollingInterval() {
	  var self = this;
	  var interval;
	
	  if (self.limits.reset && self.limits.remaining !== null &&
	    typeof self.limits.remaining !== 'undefined') {
	    var remainingMsToReset = ((this.limits.reset * 1000) - Date.now());
	
	    interval = this.limits.remaining === 0
	      ? remainingMsToReset
	      : remainingMsToReset / this.limits.remaining;
	
	    interval = Math.ceil(interval * (1 + DEFAULT_TIME_SHIFT_TOLERANCE_FACTOR));
	  }
	
	  if (!interval || interval < 0) {
	    interval = self.defaultPollingIntervalMs;
	  }
	
	  if (interval < self.minPollingIntervalMs) {
	    interval = self.minPollingIntervalMs;
	  }
	
	  return interval;
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.startIntervalPolling = function startIntervalPolling() {
	  var self = this;
	
	  if (self.timeoutId) {
	    return;
	  }
	
	  self.pollStateOnce(self.token, function onPoll(err) {
	    if (err) {
	      self.handleErrors(err);
	      return;
	    }
	
	    self.intervalPoll();
	  });
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.intervalPoll = function intervalPoll() {
	  var self = this;
	
	  clearTimeout(self.timeoutId);
	
	  var interval = self.calcPollingInterval();
	
	  // We are not using interval so we consider that the interval / tokens
	  // etc could have changed
	  self.timeoutId = setTimeout(function onPoll() {
	    self.pollStateOnce(self.token);
	
	    if (!self.timeoutId) {
	      return;
	    }
	
	    self.intervalPoll(self.token);
	  }, interval);
	};
	
	/**
	 * @private
	 */
	pollingClient.prototype.emitEvents = function emitEvents(err, oldState, newState) {
	  var self = this;
	
	  if (err) {
	    self.hub.emit('error', err);
	    return;
	  }
	
	  if (oldState && oldState.state === 'pending' &&
	  !oldState.enrollment && newState.enrollment) {
	    self.hub.emit('enrollment:confirmed', object.toCamelKeys({
	      device_account: newState.enrollment,
	      tx_id: newState.id
	    }));
	  }
	
	  if (newState.state === 'accepted') {
	    self.hub.emit('login:complete', object.toCamelKeys({
	      tx_id: newState.id,
	      signature: newState.token
	    }));
	
	    self.closeConnection();
	  }
	
	  if (newState.state === 'rejected') {
	    self.hub.emit('login:rejected', object.toCamelKeys({ tx_id: newState.id }));
	  }
	};
	
	/**
	 * Closes current connection
	 *
	 * @private
	 */
	pollingClient.prototype.closeConnection = function closeConnection() {
	  clearTimeout(this.timeoutId);
	  delete this.timeoutId;
	};
	
	/**
	 * @public
	 */
	pollingClient.prototype.connect = function connect(token, callback) {
	  this.token = token;
	  this.startIntervalPolling(token);
	  callback();
	};
	
	/**
	 * @public
	 */
	pollingClient.prototype.on = function on(event, handler) {
	  this.hub.on(event, handler);
	};
	
	/**
	 * @public
	 */
	pollingClient.prototype.once = function once(event, handler) {
	  this.hub.once(event, handler);
	};
	
	/**
	 * @public
	 */
	pollingClient.prototype.removeListener = function removeListener(event, handler) {
	  this.hub.removeListener(event, handler);
	};
	
	/**
	 * @public
	 */
	pollingClient.prototype.removeAllListeners = function removeAllListeners(eventName) {
	  this.hub.removeAllListeners(eventName);
	};
	
	module.exports = pollingClient;


/***/ }),
/* 68 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var io = __webpack_require__(69);
	var url = __webpack_require__(39);
	var events = __webpack_require__(53);
	var object = __webpack_require__(3);
	var GuardianError = __webpack_require__(9);
	var weakMap = __webpack_require__(113);
	
	var listenersMap = weakMap();
	
	function socketClient(urlBase) {
	  var self = object.create(socketClient.prototype);
	
	  if (object.isObject(urlBase)) {
	    urlBase = url.format(urlBase); // eslint-disable-line no-param-reassign
	  }
	
	  self.socket = io(urlBase, {
	    reconnection: true,
	    reconnectionDelay: 1000,
	    reconnectionDelayMax: 50000,
	    reconnectionAttempts: 5,
	    autoConnect: false
	  });
	
	  self.opened = false;
	
	  return self;
	}
	
	socketClient.prototype.connect = function connect(token, callback) {
	  var self = this;
	
	  var handlers = {
	    error: function onError(err) {
	      callback(errorBuilder(err));
	    },
	
	    unauthorized: function onUnauthorized(err) {
	      callback(new GuardianError({
	        message: 'Unauthorized real time connection',
	        statusCode: 401,
	        errorCode: 'socket_unauthorized',
	        cause: err
	      }));
	      return;
	    },
	
	    connect: function onConnect() {
	      events.onceAny(self.socket, handlers);
	      self.socket.emit('authenticate', { token: token.getToken() });
	    },
	
	    authenticated: function authenticated() {
	      callback();
	    }
	  };
	
	  events.onceAny(this.socket, handlers);
	
	  // this.socket.once('connect', function onConnect() {
	  //   this.socket.emit('authenticate', { token: token });
	  // });
	
	  this.socket.connect();
	};
	
	socketClient.prototype.addListener = function addListener(kind, event, handler) {
	  var wrapped = wrapEventHandler(handler);
	
	  listenersMap.set(handler, wrapped);
	  this.socket[kind](event, wrapped);
	};
	
	socketClient.prototype.on = function on(event, handler) {
	  this.addListener('on', event, handler);
	};
	
	socketClient.prototype.once = function once(event, handler) {
	  this.addListener('once', event, handler);
	};
	
	socketClient.prototype.removeListener = function removeListener(event, handler) {
	  var wrapped = listenersMap.get(handler);
	
	  this.socket.removeListener(event, wrapped);
	  listenersMap.del(handler);
	};
	
	socketClient.prototype.removeAllListeners = function removeAllListeners(eventName) {
	  this.socket.removeAllListeners(eventName);
	};
	
	function wrapEventHandler(handler) {
	  return function wrapper(payload) {
	    handler(object.toCamelKeys(payload));
	  };
	}
	
	function errorBuilder(err) {
	  var cErr = object.toCamelKeys(err);
	
	  return new GuardianError({
	    message: cErr.message === 'string' ? cErr.message : 'Error on real time connection',
	    statusCode: cErr.statusCode,
	    errorCode: cErr.code || 'socket_error',
	    cause: err
	  });
	}
	
	module.exports = socketClient;


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */
	
	var url = __webpack_require__(70);
	var parser = __webpack_require__(75);
	var Manager = __webpack_require__(81);
	var debug = __webpack_require__(72)('socket.io-client');
	
	/**
	 * Module exports.
	 */
	
	module.exports = exports = lookup;
	
	/**
	 * Managers cache.
	 */
	
	var cache = exports.managers = {};
	
	/**
	 * Looks up an existing `Manager` for multiplexing.
	 * If the user summons:
	 *
	 *   `io('http://localhost/a');`
	 *   `io('http://localhost/b');`
	 *
	 * We reuse the existing instance based on same scheme/port/host,
	 * and we initialize sockets for each namespace.
	 *
	 * @api public
	 */
	
	function lookup (uri, opts) {
	  if (typeof uri === 'object') {
	    opts = uri;
	    uri = undefined;
	  }
	
	  opts = opts || {};
	
	  var parsed = url(uri);
	  var source = parsed.source;
	  var id = parsed.id;
	  var path = parsed.path;
	  var sameNamespace = cache[id] && path in cache[id].nsps;
	  var newConnection = opts.forceNew || opts['force new connection'] ||
	                      false === opts.multiplex || sameNamespace;
	
	  var io;
	
	  if (newConnection) {
	    debug('ignoring socket cache for %s', source);
	    io = Manager(source, opts);
	  } else {
	    if (!cache[id]) {
	      debug('new io instance for %s', source);
	      cache[id] = Manager(source, opts);
	    }
	    io = cache[id];
	  }
	  if (parsed.query && !opts.query) {
	    opts.query = parsed.query;
	  }
	  return io.socket(parsed.path, opts);
	}
	
	/**
	 * Protocol version.
	 *
	 * @api public
	 */
	
	exports.protocol = parser.protocol;
	
	/**
	 * `connect`.
	 *
	 * @param {String} uri
	 * @api public
	 */
	
	exports.connect = lookup;
	
	/**
	 * Expose constructors for standalone build.
	 *
	 * @api public
	 */
	
	exports.Manager = __webpack_require__(81);
	exports.Socket = __webpack_require__(108);


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module dependencies.
	 */
	
	var parseuri = __webpack_require__(71);
	var debug = __webpack_require__(72)('socket.io-client:url');
	
	/**
	 * Module exports.
	 */
	
	module.exports = url;
	
	/**
	 * URL parser.
	 *
	 * @param {String} url
	 * @param {Object} An object meant to mimic window.location.
	 *                 Defaults to window.location.
	 * @api public
	 */
	
	function url (uri, loc) {
	  var obj = uri;
	
	  // default to window.location
	  loc = loc || global.location;
	  if (null == uri) uri = loc.protocol + '//' + loc.host;
	
	  // relative path support
	  if ('string' === typeof uri) {
	    if ('/' === uri.charAt(0)) {
	      if ('/' === uri.charAt(1)) {
	        uri = loc.protocol + uri;
	      } else {
	        uri = loc.host + uri;
	      }
	    }
	
	    if (!/^(https?|wss?):\/\//.test(uri)) {
	      debug('protocol-less url %s', uri);
	      if ('undefined' !== typeof loc) {
	        uri = loc.protocol + '//' + uri;
	      } else {
	        uri = 'https://' + uri;
	      }
	    }
	
	    // parse
	    debug('parse %s', uri);
	    obj = parseuri(uri);
	  }
	
	  // make sure we treat `localhost:80` and `localhost` equally
	  if (!obj.port) {
	    if (/^(http|ws)$/.test(obj.protocol)) {
	      obj.port = '80';
	    } else if (/^(http|ws)s$/.test(obj.protocol)) {
	      obj.port = '443';
	    }
	  }
	
	  obj.path = obj.path || '/';
	
	  var ipv6 = obj.host.indexOf(':') !== -1;
	  var host = ipv6 ? '[' + obj.host + ']' : obj.host;
	
	  // define unique id
	  obj.id = obj.protocol + '://' + host + ':' + obj.port;
	  // define href
	  obj.href = obj.protocol + '://' + host + (loc && loc.port === obj.port ? '' : (':' + obj.port));
	
	  return obj;
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 71 */
/***/ (function(module, exports) {

	/**
	 * Parses an URI
	 *
	 * @author Steven Levithan <stevenlevithan.com> (MIT license)
	 * @api private
	 */
	
	var re = /^(?:(?![^:@]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
	
	var parts = [
	    'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
	];
	
	module.exports = function parseuri(str) {
	    var src = str,
	        b = str.indexOf('['),
	        e = str.indexOf(']');
	
	    if (b != -1 && e != -1) {
	        str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
	    }
	
	    var m = re.exec(str || ''),
	        uri = {},
	        i = 14;
	
	    while (i--) {
	        uri[parts[i]] = m[i] || '';
	    }
	
	    if (b != -1 && e != -1) {
	        uri.source = src;
	        uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
	        uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
	        uri.ipv6uri = true;
	    }
	
	    return uri;
	};


/***/ }),
/* 72 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(process) {/**
	 * This is the web browser implementation of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = __webpack_require__(73);
	exports.log = log;
	exports.formatArgs = formatArgs;
	exports.save = save;
	exports.load = load;
	exports.useColors = useColors;
	exports.storage = 'undefined' != typeof chrome
	               && 'undefined' != typeof chrome.storage
	                  ? chrome.storage.local
	                  : localstorage();
	
	/**
	 * Colors.
	 */
	
	exports.colors = [
	  'lightseagreen',
	  'forestgreen',
	  'goldenrod',
	  'dodgerblue',
	  'darkorchid',
	  'crimson'
	];
	
	/**
	 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
	 * and the Firebug extension (any Firefox version) are known
	 * to support "%c" CSS customizations.
	 *
	 * TODO: add a `localStorage` variable to explicitly enable/disable colors
	 */
	
	function useColors() {
	  // NB: In an Electron preload script, document will be defined but not fully
	  // initialized. Since we know we're in Chrome, we'll just detect this case
	  // explicitly
	  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
	    return true;
	  }
	
	  // is webkit? http://stackoverflow.com/a/16459606/376773
	  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
	  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
	    // is firebug? http://stackoverflow.com/a/398120/376773
	    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
	    // is firefox >= v31?
	    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
	    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
	    // double check webkit in userAgent just in case we are in a worker
	    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
	}
	
	/**
	 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
	 */
	
	exports.formatters.j = function(v) {
	  try {
	    return JSON.stringify(v);
	  } catch (err) {
	    return '[UnexpectedJSONParseError]: ' + err.message;
	  }
	};
	
	
	/**
	 * Colorize log arguments if enabled.
	 *
	 * @api public
	 */
	
	function formatArgs(args) {
	  var useColors = this.useColors;
	
	  args[0] = (useColors ? '%c' : '')
	    + this.namespace
	    + (useColors ? ' %c' : ' ')
	    + args[0]
	    + (useColors ? '%c ' : ' ')
	    + '+' + exports.humanize(this.diff);
	
	  if (!useColors) return;
	
	  var c = 'color: ' + this.color;
	  args.splice(1, 0, c, 'color: inherit')
	
	  // the final "%c" is somewhat tricky, because there could be other
	  // arguments passed either before or after the %c, so we need to
	  // figure out the correct index to insert the CSS into
	  var index = 0;
	  var lastC = 0;
	  args[0].replace(/%[a-zA-Z%]/g, function(match) {
	    if ('%%' === match) return;
	    index++;
	    if ('%c' === match) {
	      // we only are interested in the *last* %c
	      // (the user may have provided their own)
	      lastC = index;
	    }
	  });
	
	  args.splice(lastC, 0, c);
	}
	
	/**
	 * Invokes `console.log()` when available.
	 * No-op when `console.log` is not a "function".
	 *
	 * @api public
	 */
	
	function log() {
	  // this hackery is required for IE8/9, where
	  // the `console.log` function doesn't have 'apply'
	  return 'object' === typeof console
	    && console.log
	    && Function.prototype.apply.call(console.log, console, arguments);
	}
	
	/**
	 * Save `namespaces`.
	 *
	 * @param {String} namespaces
	 * @api private
	 */
	
	function save(namespaces) {
	  try {
	    if (null == namespaces) {
	      exports.storage.removeItem('debug');
	    } else {
	      exports.storage.debug = namespaces;
	    }
	  } catch(e) {}
	}
	
	/**
	 * Load `namespaces`.
	 *
	 * @return {String} returns the previously persisted debug modes
	 * @api private
	 */
	
	function load() {
	  var r;
	  try {
	    r = exports.storage.debug;
	  } catch(e) {}
	
	  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
	  if (!r && typeof process !== 'undefined' && 'env' in process) {
	    r = process.env.DEBUG;
	  }
	
	  return r;
	}
	
	/**
	 * Enable namespaces listed in `localStorage.debug` initially.
	 */
	
	exports.enable(load());
	
	/**
	 * Localstorage attempts to return the localstorage.
	 *
	 * This is necessary because safari throws
	 * when a user disables cookies/localstorage
	 * and you attempt to access it.
	 *
	 * @return {LocalStorage}
	 * @api private
	 */
	
	function localstorage() {
	  try {
	    return window.localStorage;
	  } catch (e) {}
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(7)))

/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * This is the common logic for both the Node.js and web browser
	 * implementations of `debug()`.
	 *
	 * Expose `debug()` as the module.
	 */
	
	exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
	exports.coerce = coerce;
	exports.disable = disable;
	exports.enable = enable;
	exports.enabled = enabled;
	exports.humanize = __webpack_require__(74);
	
	/**
	 * The currently active debug mode names, and names to skip.
	 */
	
	exports.names = [];
	exports.skips = [];
	
	/**
	 * Map of special "%n" handling functions, for the debug "format" argument.
	 *
	 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
	 */
	
	exports.formatters = {};
	
	/**
	 * Previous log timestamp.
	 */
	
	var prevTime;
	
	/**
	 * Select a color.
	 * @param {String} namespace
	 * @return {Number}
	 * @api private
	 */
	
	function selectColor(namespace) {
	  var hash = 0, i;
	
	  for (i in namespace) {
	    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
	    hash |= 0; // Convert to 32bit integer
	  }
	
	  return exports.colors[Math.abs(hash) % exports.colors.length];
	}
	
	/**
	 * Create a debugger with the given `namespace`.
	 *
	 * @param {String} namespace
	 * @return {Function}
	 * @api public
	 */
	
	function createDebug(namespace) {
	
	  function debug() {
	    // disabled?
	    if (!debug.enabled) return;
	
	    var self = debug;
	
	    // set `diff` timestamp
	    var curr = +new Date();
	    var ms = curr - (prevTime || curr);
	    self.diff = ms;
	    self.prev = prevTime;
	    self.curr = curr;
	    prevTime = curr;
	
	    // turn the `arguments` into a proper Array
	    var args = new Array(arguments.length);
	    for (var i = 0; i < args.length; i++) {
	      args[i] = arguments[i];
	    }
	
	    args[0] = exports.coerce(args[0]);
	
	    if ('string' !== typeof args[0]) {
	      // anything else let's inspect with %O
	      args.unshift('%O');
	    }
	
	    // apply any `formatters` transformations
	    var index = 0;
	    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
	      // if we encounter an escaped % then don't increase the array index
	      if (match === '%%') return match;
	      index++;
	      var formatter = exports.formatters[format];
	      if ('function' === typeof formatter) {
	        var val = args[index];
	        match = formatter.call(self, val);
	
	        // now we need to remove `args[index]` since it's inlined in the `format`
	        args.splice(index, 1);
	        index--;
	      }
	      return match;
	    });
	
	    // apply env-specific formatting (colors, etc.)
	    exports.formatArgs.call(self, args);
	
	    var logFn = debug.log || exports.log || console.log.bind(console);
	    logFn.apply(self, args);
	  }
	
	  debug.namespace = namespace;
	  debug.enabled = exports.enabled(namespace);
	  debug.useColors = exports.useColors();
	  debug.color = selectColor(namespace);
	
	  // env-specific initialization logic for debug instances
	  if ('function' === typeof exports.init) {
	    exports.init(debug);
	  }
	
	  return debug;
	}
	
	/**
	 * Enables a debug mode by namespaces. This can include modes
	 * separated by a colon and wildcards.
	 *
	 * @param {String} namespaces
	 * @api public
	 */
	
	function enable(namespaces) {
	  exports.save(namespaces);
	
	  exports.names = [];
	  exports.skips = [];
	
	  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
	  var len = split.length;
	
	  for (var i = 0; i < len; i++) {
	    if (!split[i]) continue; // ignore empty strings
	    namespaces = split[i].replace(/\*/g, '.*?');
	    if (namespaces[0] === '-') {
	      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
	    } else {
	      exports.names.push(new RegExp('^' + namespaces + '$'));
	    }
	  }
	}
	
	/**
	 * Disable debug output.
	 *
	 * @api public
	 */
	
	function disable() {
	  exports.enable('');
	}
	
	/**
	 * Returns true if the given mode name is enabled, false otherwise.
	 *
	 * @param {String} name
	 * @return {Boolean}
	 * @api public
	 */
	
	function enabled(name) {
	  var i, len;
	  for (i = 0, len = exports.skips.length; i < len; i++) {
	    if (exports.skips[i].test(name)) {
	      return false;
	    }
	  }
	  for (i = 0, len = exports.names.length; i < len; i++) {
	    if (exports.names[i].test(name)) {
	      return true;
	    }
	  }
	  return false;
	}
	
	/**
	 * Coerce `val`.
	 *
	 * @param {Mixed} val
	 * @return {Mixed}
	 * @api private
	 */
	
	function coerce(val) {
	  if (val instanceof Error) return val.stack || val.message;
	  return val;
	}


/***/ }),
/* 74 */
/***/ (function(module, exports) {

	/**
	 * Helpers.
	 */
	
	var s = 1000;
	var m = s * 60;
	var h = m * 60;
	var d = h * 24;
	var y = d * 365.25;
	
	/**
	 * Parse or format the given `val`.
	 *
	 * Options:
	 *
	 *  - `long` verbose formatting [false]
	 *
	 * @param {String|Number} val
	 * @param {Object} [options]
	 * @throws {Error} throw an error if val is not a non-empty string or a number
	 * @return {String|Number}
	 * @api public
	 */
	
	module.exports = function(val, options) {
	  options = options || {};
	  var type = typeof val;
	  if (type === 'string' && val.length > 0) {
	    return parse(val);
	  } else if (type === 'number' && isNaN(val) === false) {
	    return options.long ? fmtLong(val) : fmtShort(val);
	  }
	  throw new Error(
	    'val is not a non-empty string or a valid number. val=' +
	      JSON.stringify(val)
	  );
	};
	
	/**
	 * Parse the given `str` and return milliseconds.
	 *
	 * @param {String} str
	 * @return {Number}
	 * @api private
	 */
	
	function parse(str) {
	  str = String(str);
	  if (str.length > 100) {
	    return;
	  }
	  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
	    str
	  );
	  if (!match) {
	    return;
	  }
	  var n = parseFloat(match[1]);
	  var type = (match[2] || 'ms').toLowerCase();
	  switch (type) {
	    case 'years':
	    case 'year':
	    case 'yrs':
	    case 'yr':
	    case 'y':
	      return n * y;
	    case 'days':
	    case 'day':
	    case 'd':
	      return n * d;
	    case 'hours':
	    case 'hour':
	    case 'hrs':
	    case 'hr':
	    case 'h':
	      return n * h;
	    case 'minutes':
	    case 'minute':
	    case 'mins':
	    case 'min':
	    case 'm':
	      return n * m;
	    case 'seconds':
	    case 'second':
	    case 'secs':
	    case 'sec':
	    case 's':
	      return n * s;
	    case 'milliseconds':
	    case 'millisecond':
	    case 'msecs':
	    case 'msec':
	    case 'ms':
	      return n;
	    default:
	      return undefined;
	  }
	}
	
	/**
	 * Short format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function fmtShort(ms) {
	  if (ms >= d) {
	    return Math.round(ms / d) + 'd';
	  }
	  if (ms >= h) {
	    return Math.round(ms / h) + 'h';
	  }
	  if (ms >= m) {
	    return Math.round(ms / m) + 'm';
	  }
	  if (ms >= s) {
	    return Math.round(ms / s) + 's';
	  }
	  return ms + 'ms';
	}
	
	/**
	 * Long format for `ms`.
	 *
	 * @param {Number} ms
	 * @return {String}
	 * @api private
	 */
	
	function fmtLong(ms) {
	  return plural(ms, d, 'day') ||
	    plural(ms, h, 'hour') ||
	    plural(ms, m, 'minute') ||
	    plural(ms, s, 'second') ||
	    ms + ' ms';
	}
	
	/**
	 * Pluralization helper.
	 */
	
	function plural(ms, n, name) {
	  if (ms < n) {
	    return;
	  }
	  if (ms < n * 1.5) {
	    return Math.floor(ms / n) + ' ' + name;
	  }
	  return Math.ceil(ms / n) + ' ' + name + 's';
	}


/***/ }),
/* 75 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */
	
	var debug = __webpack_require__(72)('socket.io-parser');
	var Emitter = __webpack_require__(76);
	var hasBin = __webpack_require__(77);
	var binary = __webpack_require__(79);
	var isBuf = __webpack_require__(80);
	
	/**
	 * Protocol version.
	 *
	 * @api public
	 */
	
	exports.protocol = 4;
	
	/**
	 * Packet types.
	 *
	 * @api public
	 */
	
	exports.types = [
	  'CONNECT',
	  'DISCONNECT',
	  'EVENT',
	  'ACK',
	  'ERROR',
	  'BINARY_EVENT',
	  'BINARY_ACK'
	];
	
	/**
	 * Packet type `connect`.
	 *
	 * @api public
	 */
	
	exports.CONNECT = 0;
	
	/**
	 * Packet type `disconnect`.
	 *
	 * @api public
	 */
	
	exports.DISCONNECT = 1;
	
	/**
	 * Packet type `event`.
	 *
	 * @api public
	 */
	
	exports.EVENT = 2;
	
	/**
	 * Packet type `ack`.
	 *
	 * @api public
	 */
	
	exports.ACK = 3;
	
	/**
	 * Packet type `error`.
	 *
	 * @api public
	 */
	
	exports.ERROR = 4;
	
	/**
	 * Packet type 'binary event'
	 *
	 * @api public
	 */
	
	exports.BINARY_EVENT = 5;
	
	/**
	 * Packet type `binary ack`. For acks with binary arguments.
	 *
	 * @api public
	 */
	
	exports.BINARY_ACK = 6;
	
	/**
	 * Encoder constructor.
	 *
	 * @api public
	 */
	
	exports.Encoder = Encoder;
	
	/**
	 * Decoder constructor.
	 *
	 * @api public
	 */
	
	exports.Decoder = Decoder;
	
	/**
	 * A socket.io Encoder instance
	 *
	 * @api public
	 */
	
	function Encoder() {}
	
	/**
	 * Encode a packet as a single string if non-binary, or as a
	 * buffer sequence, depending on packet type.
	 *
	 * @param {Object} obj - packet object
	 * @param {Function} callback - function to handle encodings (likely engine.write)
	 * @return Calls callback with Array of encodings
	 * @api public
	 */
	
	Encoder.prototype.encode = function(obj, callback){
	  if ((obj.type === exports.EVENT || obj.type === exports.ACK) && hasBin(obj.data)) {
	    obj.type = obj.type === exports.EVENT ? exports.BINARY_EVENT : exports.BINARY_ACK;
	  }
	
	  debug('encoding packet %j', obj);
	
	  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
	    encodeAsBinary(obj, callback);
	  }
	  else {
	    var encoding = encodeAsString(obj);
	    callback([encoding]);
	  }
	};
	
	/**
	 * Encode packet as string.
	 *
	 * @param {Object} packet
	 * @return {String} encoded
	 * @api private
	 */
	
	function encodeAsString(obj) {
	
	  // first is type
	  var str = '' + obj.type;
	
	  // attachments if we have them
	  if (exports.BINARY_EVENT === obj.type || exports.BINARY_ACK === obj.type) {
	    str += obj.attachments + '-';
	  }
	
	  // if we have a namespace other than `/`
	  // we append it followed by a comma `,`
	  if (obj.nsp && '/' !== obj.nsp) {
	    str += obj.nsp + ',';
	  }
	
	  // immediately followed by the id
	  if (null != obj.id) {
	    str += obj.id;
	  }
	
	  // json data
	  if (null != obj.data) {
	    str += JSON.stringify(obj.data);
	  }
	
	  debug('encoded %j as %s', obj, str);
	  return str;
	}
	
	/**
	 * Encode packet as 'buffer sequence' by removing blobs, and
	 * deconstructing packet into object with placeholders and
	 * a list of buffers.
	 *
	 * @param {Object} packet
	 * @return {Buffer} encoded
	 * @api private
	 */
	
	function encodeAsBinary(obj, callback) {
	
	  function writeEncoding(bloblessData) {
	    var deconstruction = binary.deconstructPacket(bloblessData);
	    var pack = encodeAsString(deconstruction.packet);
	    var buffers = deconstruction.buffers;
	
	    buffers.unshift(pack); // add packet info to beginning of data list
	    callback(buffers); // write all the buffers
	  }
	
	  binary.removeBlobs(obj, writeEncoding);
	}
	
	/**
	 * A socket.io Decoder instance
	 *
	 * @return {Object} decoder
	 * @api public
	 */
	
	function Decoder() {
	  this.reconstructor = null;
	}
	
	/**
	 * Mix in `Emitter` with Decoder.
	 */
	
	Emitter(Decoder.prototype);
	
	/**
	 * Decodes an ecoded packet string into packet JSON.
	 *
	 * @param {String} obj - encoded packet
	 * @return {Object} packet
	 * @api public
	 */
	
	Decoder.prototype.add = function(obj) {
	  var packet;
	  if (typeof obj === 'string') {
	    packet = decodeString(obj);
	    if (exports.BINARY_EVENT === packet.type || exports.BINARY_ACK === packet.type) { // binary packet's json
	      this.reconstructor = new BinaryReconstructor(packet);
	
	      // no attachments, labeled binary but no binary data to follow
	      if (this.reconstructor.reconPack.attachments === 0) {
	        this.emit('decoded', packet);
	      }
	    } else { // non-binary full packet
	      this.emit('decoded', packet);
	    }
	  }
	  else if (isBuf(obj) || obj.base64) { // raw binary data
	    if (!this.reconstructor) {
	      throw new Error('got binary data when not reconstructing a packet');
	    } else {
	      packet = this.reconstructor.takeBinaryData(obj);
	      if (packet) { // received final buffer
	        this.reconstructor = null;
	        this.emit('decoded', packet);
	      }
	    }
	  }
	  else {
	    throw new Error('Unknown type: ' + obj);
	  }
	};
	
	/**
	 * Decode a packet String (JSON data)
	 *
	 * @param {String} str
	 * @return {Object} packet
	 * @api private
	 */
	
	function decodeString(str) {
	  var i = 0;
	  // look up type
	  var p = {
	    type: Number(str.charAt(0))
	  };
	
	  if (null == exports.types[p.type]) return error();
	
	  // look up attachments if type binary
	  if (exports.BINARY_EVENT === p.type || exports.BINARY_ACK === p.type) {
	    var buf = '';
	    while (str.charAt(++i) !== '-') {
	      buf += str.charAt(i);
	      if (i == str.length) break;
	    }
	    if (buf != Number(buf) || str.charAt(i) !== '-') {
	      throw new Error('Illegal attachments');
	    }
	    p.attachments = Number(buf);
	  }
	
	  // look up namespace (if any)
	  if ('/' === str.charAt(i + 1)) {
	    p.nsp = '';
	    while (++i) {
	      var c = str.charAt(i);
	      if (',' === c) break;
	      p.nsp += c;
	      if (i === str.length) break;
	    }
	  } else {
	    p.nsp = '/';
	  }
	
	  // look up id
	  var next = str.charAt(i + 1);
	  if ('' !== next && Number(next) == next) {
	    p.id = '';
	    while (++i) {
	      var c = str.charAt(i);
	      if (null == c || Number(c) != c) {
	        --i;
	        break;
	      }
	      p.id += str.charAt(i);
	      if (i === str.length) break;
	    }
	    p.id = Number(p.id);
	  }
	
	  // look up json data
	  if (str.charAt(++i)) {
	    p = tryParse(p, str.substr(i));
	  }
	
	  debug('decoded %s as %j', str, p);
	  return p;
	}
	
	function tryParse(p, str) {
	  try {
	    p.data = JSON.parse(str);
	  } catch(e){
	    return error();
	  }
	  return p; 
	}
	
	/**
	 * Deallocates a parser's resources
	 *
	 * @api public
	 */
	
	Decoder.prototype.destroy = function() {
	  if (this.reconstructor) {
	    this.reconstructor.finishedReconstruction();
	  }
	};
	
	/**
	 * A manager of a binary event's 'buffer sequence'. Should
	 * be constructed whenever a packet of type BINARY_EVENT is
	 * decoded.
	 *
	 * @param {Object} packet
	 * @return {BinaryReconstructor} initialized reconstructor
	 * @api private
	 */
	
	function BinaryReconstructor(packet) {
	  this.reconPack = packet;
	  this.buffers = [];
	}
	
	/**
	 * Method to be called when binary data received from connection
	 * after a BINARY_EVENT packet.
	 *
	 * @param {Buffer | ArrayBuffer} binData - the raw binary data received
	 * @return {null | Object} returns null if more binary data is expected or
	 *   a reconstructed packet object if all buffers have been received.
	 * @api private
	 */
	
	BinaryReconstructor.prototype.takeBinaryData = function(binData) {
	  this.buffers.push(binData);
	  if (this.buffers.length === this.reconPack.attachments) { // done with buffer list
	    var packet = binary.reconstructPacket(this.reconPack, this.buffers);
	    this.finishedReconstruction();
	    return packet;
	  }
	  return null;
	};
	
	/**
	 * Cleans up binary packet reconstruction variables.
	 *
	 * @api private
	 */
	
	BinaryReconstructor.prototype.finishedReconstruction = function() {
	  this.reconPack = null;
	  this.buffers = [];
	};
	
	function error() {
	  return {
	    type: exports.ERROR,
	    data: 'parser error'
	  };
	}


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `Emitter`.
	 */
	
	if (true) {
	  module.exports = Emitter;
	}
	
	/**
	 * Initialize a new `Emitter`.
	 *
	 * @api public
	 */
	
	function Emitter(obj) {
	  if (obj) return mixin(obj);
	};
	
	/**
	 * Mixin the emitter properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */
	
	function mixin(obj) {
	  for (var key in Emitter.prototype) {
	    obj[key] = Emitter.prototype[key];
	  }
	  return obj;
	}
	
	/**
	 * Listen on the given `event` with `fn`.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.on =
	Emitter.prototype.addEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
	    .push(fn);
	  return this;
	};
	
	/**
	 * Adds an `event` listener that will be invoked a single
	 * time then automatically removed.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.once = function(event, fn){
	  function on() {
	    this.off(event, on);
	    fn.apply(this, arguments);
	  }
	
	  on.fn = fn;
	  this.on(event, on);
	  return this;
	};
	
	/**
	 * Remove the given callback for `event` or all
	 * registered callbacks.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */
	
	Emitter.prototype.off =
	Emitter.prototype.removeListener =
	Emitter.prototype.removeAllListeners =
	Emitter.prototype.removeEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	
	  // all
	  if (0 == arguments.length) {
	    this._callbacks = {};
	    return this;
	  }
	
	  // specific event
	  var callbacks = this._callbacks['$' + event];
	  if (!callbacks) return this;
	
	  // remove all handlers
	  if (1 == arguments.length) {
	    delete this._callbacks['$' + event];
	    return this;
	  }
	
	  // remove specific handler
	  var cb;
	  for (var i = 0; i < callbacks.length; i++) {
	    cb = callbacks[i];
	    if (cb === fn || cb.fn === fn) {
	      callbacks.splice(i, 1);
	      break;
	    }
	  }
	  return this;
	};
	
	/**
	 * Emit `event` with the given args.
	 *
	 * @param {String} event
	 * @param {Mixed} ...
	 * @return {Emitter}
	 */
	
	Emitter.prototype.emit = function(event){
	  this._callbacks = this._callbacks || {};
	  var args = [].slice.call(arguments, 1)
	    , callbacks = this._callbacks['$' + event];
	
	  if (callbacks) {
	    callbacks = callbacks.slice(0);
	    for (var i = 0, len = callbacks.length; i < len; ++i) {
	      callbacks[i].apply(this, args);
	    }
	  }
	
	  return this;
	};
	
	/**
	 * Return array of callbacks for `event`.
	 *
	 * @param {String} event
	 * @return {Array}
	 * @api public
	 */
	
	Emitter.prototype.listeners = function(event){
	  this._callbacks = this._callbacks || {};
	  return this._callbacks['$' + event] || [];
	};
	
	/**
	 * Check if this emitter has `event` handlers.
	 *
	 * @param {String} event
	 * @return {Boolean}
	 * @api public
	 */
	
	Emitter.prototype.hasListeners = function(event){
	  return !! this.listeners(event).length;
	};


/***/ }),
/* 77 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/* global Blob File */
	
	/*
	 * Module requirements.
	 */
	
	var isArray = __webpack_require__(78);
	
	var toString = Object.prototype.toString;
	var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
	var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';
	
	/**
	 * Module exports.
	 */
	
	module.exports = hasBinary;
	
	/**
	 * Checks for binary data.
	 *
	 * Supports Buffer, ArrayBuffer, Blob and File.
	 *
	 * @param {Object} anything
	 * @api public
	 */
	
	function hasBinary (obj) {
	  if (!obj || typeof obj !== 'object') {
	    return false;
	  }
	
	  if (isArray(obj)) {
	    for (var i = 0, l = obj.length; i < l; i++) {
	      if (hasBinary(obj[i])) {
	        return true;
	      }
	    }
	    return false;
	  }
	
	  if ((typeof global.Buffer === 'function' && global.Buffer.isBuffer && global.Buffer.isBuffer(obj)) ||
	     (typeof global.ArrayBuffer === 'function' && obj instanceof ArrayBuffer) ||
	     (withNativeBlob && obj instanceof Blob) ||
	     (withNativeFile && obj instanceof File)
	    ) {
	    return true;
	  }
	
	  // see: https://github.com/Automattic/has-binary/pull/4
	  if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
	    return hasBinary(obj.toJSON(), true);
	  }
	
	  for (var key in obj) {
	    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
	      return true;
	    }
	  }
	
	  return false;
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 78 */
/***/ (function(module, exports) {

	var toString = {}.toString;
	
	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/*global Blob,File*/
	
	/**
	 * Module requirements
	 */
	
	var isArray = __webpack_require__(78);
	var isBuf = __webpack_require__(80);
	var toString = Object.prototype.toString;
	var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
	var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';
	
	/**
	 * Replaces every Buffer | ArrayBuffer in packet with a numbered placeholder.
	 * Anything with blobs or files should be fed through removeBlobs before coming
	 * here.
	 *
	 * @param {Object} packet - socket.io event packet
	 * @return {Object} with deconstructed packet and list of buffers
	 * @api public
	 */
	
	exports.deconstructPacket = function(packet) {
	  var buffers = [];
	  var packetData = packet.data;
	  var pack = packet;
	  pack.data = _deconstructPacket(packetData, buffers);
	  pack.attachments = buffers.length; // number of binary 'attachments'
	  return {packet: pack, buffers: buffers};
	};
	
	function _deconstructPacket(data, buffers) {
	  if (!data) return data;
	
	  if (isBuf(data)) {
	    var placeholder = { _placeholder: true, num: buffers.length };
	    buffers.push(data);
	    return placeholder;
	  } else if (isArray(data)) {
	    var newData = new Array(data.length);
	    for (var i = 0; i < data.length; i++) {
	      newData[i] = _deconstructPacket(data[i], buffers);
	    }
	    return newData;
	  } else if (typeof data === 'object' && !(data instanceof Date)) {
	    var newData = {};
	    for (var key in data) {
	      newData[key] = _deconstructPacket(data[key], buffers);
	    }
	    return newData;
	  }
	  return data;
	}
	
	/**
	 * Reconstructs a binary packet from its placeholder packet and buffers
	 *
	 * @param {Object} packet - event packet with placeholders
	 * @param {Array} buffers - binary buffers to put in placeholder positions
	 * @return {Object} reconstructed packet
	 * @api public
	 */
	
	exports.reconstructPacket = function(packet, buffers) {
	  packet.data = _reconstructPacket(packet.data, buffers);
	  packet.attachments = undefined; // no longer useful
	  return packet;
	};
	
	function _reconstructPacket(data, buffers) {
	  if (!data) return data;
	
	  if (data && data._placeholder) {
	    return buffers[data.num]; // appropriate buffer (should be natural order anyway)
	  } else if (isArray(data)) {
	    for (var i = 0; i < data.length; i++) {
	      data[i] = _reconstructPacket(data[i], buffers);
	    }
	  } else if (typeof data === 'object') {
	    for (var key in data) {
	      data[key] = _reconstructPacket(data[key], buffers);
	    }
	  }
	
	  return data;
	}
	
	/**
	 * Asynchronously removes Blobs or Files from data via
	 * FileReader's readAsArrayBuffer method. Used before encoding
	 * data as msgpack. Calls callback with the blobless data.
	 *
	 * @param {Object} data
	 * @param {Function} callback
	 * @api private
	 */
	
	exports.removeBlobs = function(data, callback) {
	  function _removeBlobs(obj, curKey, containingObject) {
	    if (!obj) return obj;
	
	    // convert any blob
	    if ((withNativeBlob && obj instanceof Blob) ||
	        (withNativeFile && obj instanceof File)) {
	      pendingBlobs++;
	
	      // async filereader
	      var fileReader = new FileReader();
	      fileReader.onload = function() { // this.result == arraybuffer
	        if (containingObject) {
	          containingObject[curKey] = this.result;
	        }
	        else {
	          bloblessData = this.result;
	        }
	
	        // if nothing pending its callback time
	        if(! --pendingBlobs) {
	          callback(bloblessData);
	        }
	      };
	
	      fileReader.readAsArrayBuffer(obj); // blob -> arraybuffer
	    } else if (isArray(obj)) { // handle array
	      for (var i = 0; i < obj.length; i++) {
	        _removeBlobs(obj[i], i, obj);
	      }
	    } else if (typeof obj === 'object' && !isBuf(obj)) { // and object
	      for (var key in obj) {
	        _removeBlobs(obj[key], key, obj);
	      }
	    }
	  }
	
	  var pendingBlobs = 0;
	  var bloblessData = data;
	  _removeBlobs(bloblessData);
	  if (!pendingBlobs) {
	    callback(bloblessData);
	  }
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 80 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {
	module.exports = isBuf;
	
	/**
	 * Returns true if obj is a buffer or an arraybuffer.
	 *
	 * @api private
	 */
	
	function isBuf(obj) {
	  return (global.Buffer && global.Buffer.isBuffer(obj)) ||
	         (global.ArrayBuffer && obj instanceof ArrayBuffer);
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */
	
	var eio = __webpack_require__(82);
	var Socket = __webpack_require__(108);
	var Emitter = __webpack_require__(76);
	var parser = __webpack_require__(75);
	var on = __webpack_require__(110);
	var bind = __webpack_require__(111);
	var debug = __webpack_require__(72)('socket.io-client:manager');
	var indexOf = __webpack_require__(106);
	var Backoff = __webpack_require__(112);
	
	/**
	 * IE6+ hasOwnProperty
	 */
	
	var has = Object.prototype.hasOwnProperty;
	
	/**
	 * Module exports
	 */
	
	module.exports = Manager;
	
	/**
	 * `Manager` constructor.
	 *
	 * @param {String} engine instance or engine uri/opts
	 * @param {Object} options
	 * @api public
	 */
	
	function Manager (uri, opts) {
	  if (!(this instanceof Manager)) return new Manager(uri, opts);
	  if (uri && ('object' === typeof uri)) {
	    opts = uri;
	    uri = undefined;
	  }
	  opts = opts || {};
	
	  opts.path = opts.path || '/socket.io';
	  this.nsps = {};
	  this.subs = [];
	  this.opts = opts;
	  this.reconnection(opts.reconnection !== false);
	  this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
	  this.reconnectionDelay(opts.reconnectionDelay || 1000);
	  this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
	  this.randomizationFactor(opts.randomizationFactor || 0.5);
	  this.backoff = new Backoff({
	    min: this.reconnectionDelay(),
	    max: this.reconnectionDelayMax(),
	    jitter: this.randomizationFactor()
	  });
	  this.timeout(null == opts.timeout ? 20000 : opts.timeout);
	  this.readyState = 'closed';
	  this.uri = uri;
	  this.connecting = [];
	  this.lastPing = null;
	  this.encoding = false;
	  this.packetBuffer = [];
	  var _parser = opts.parser || parser;
	  this.encoder = new _parser.Encoder();
	  this.decoder = new _parser.Decoder();
	  this.autoConnect = opts.autoConnect !== false;
	  if (this.autoConnect) this.open();
	}
	
	/**
	 * Propagate given event to sockets and emit on `this`
	 *
	 * @api private
	 */
	
	Manager.prototype.emitAll = function () {
	  this.emit.apply(this, arguments);
	  for (var nsp in this.nsps) {
	    if (has.call(this.nsps, nsp)) {
	      this.nsps[nsp].emit.apply(this.nsps[nsp], arguments);
	    }
	  }
	};
	
	/**
	 * Update `socket.id` of all sockets
	 *
	 * @api private
	 */
	
	Manager.prototype.updateSocketIds = function () {
	  for (var nsp in this.nsps) {
	    if (has.call(this.nsps, nsp)) {
	      this.nsps[nsp].id = this.generateId(nsp);
	    }
	  }
	};
	
	/**
	 * generate `socket.id` for the given `nsp`
	 *
	 * @param {String} nsp
	 * @return {String}
	 * @api private
	 */
	
	Manager.prototype.generateId = function (nsp) {
	  return (nsp === '/' ? '' : (nsp + '#')) + this.engine.id;
	};
	
	/**
	 * Mix in `Emitter`.
	 */
	
	Emitter(Manager.prototype);
	
	/**
	 * Sets the `reconnection` config.
	 *
	 * @param {Boolean} true/false if it should automatically reconnect
	 * @return {Manager} self or value
	 * @api public
	 */
	
	Manager.prototype.reconnection = function (v) {
	  if (!arguments.length) return this._reconnection;
	  this._reconnection = !!v;
	  return this;
	};
	
	/**
	 * Sets the reconnection attempts config.
	 *
	 * @param {Number} max reconnection attempts before giving up
	 * @return {Manager} self or value
	 * @api public
	 */
	
	Manager.prototype.reconnectionAttempts = function (v) {
	  if (!arguments.length) return this._reconnectionAttempts;
	  this._reconnectionAttempts = v;
	  return this;
	};
	
	/**
	 * Sets the delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */
	
	Manager.prototype.reconnectionDelay = function (v) {
	  if (!arguments.length) return this._reconnectionDelay;
	  this._reconnectionDelay = v;
	  this.backoff && this.backoff.setMin(v);
	  return this;
	};
	
	Manager.prototype.randomizationFactor = function (v) {
	  if (!arguments.length) return this._randomizationFactor;
	  this._randomizationFactor = v;
	  this.backoff && this.backoff.setJitter(v);
	  return this;
	};
	
	/**
	 * Sets the maximum delay between reconnections.
	 *
	 * @param {Number} delay
	 * @return {Manager} self or value
	 * @api public
	 */
	
	Manager.prototype.reconnectionDelayMax = function (v) {
	  if (!arguments.length) return this._reconnectionDelayMax;
	  this._reconnectionDelayMax = v;
	  this.backoff && this.backoff.setMax(v);
	  return this;
	};
	
	/**
	 * Sets the connection timeout. `false` to disable
	 *
	 * @return {Manager} self or value
	 * @api public
	 */
	
	Manager.prototype.timeout = function (v) {
	  if (!arguments.length) return this._timeout;
	  this._timeout = v;
	  return this;
	};
	
	/**
	 * Starts trying to reconnect if reconnection is enabled and we have not
	 * started reconnecting yet
	 *
	 * @api private
	 */
	
	Manager.prototype.maybeReconnectOnOpen = function () {
	  // Only try to reconnect if it's the first time we're connecting
	  if (!this.reconnecting && this._reconnection && this.backoff.attempts === 0) {
	    // keeps reconnection from firing twice for the same reconnection loop
	    this.reconnect();
	  }
	};
	
	/**
	 * Sets the current transport `socket`.
	 *
	 * @param {Function} optional, callback
	 * @return {Manager} self
	 * @api public
	 */
	
	Manager.prototype.open =
	Manager.prototype.connect = function (fn, opts) {
	  debug('readyState %s', this.readyState);
	  if (~this.readyState.indexOf('open')) return this;
	
	  debug('opening %s', this.uri);
	  this.engine = eio(this.uri, this.opts);
	  var socket = this.engine;
	  var self = this;
	  this.readyState = 'opening';
	  this.skipReconnect = false;
	
	  // emit `open`
	  var openSub = on(socket, 'open', function () {
	    self.onopen();
	    fn && fn();
	  });
	
	  // emit `connect_error`
	  var errorSub = on(socket, 'error', function (data) {
	    debug('connect_error');
	    self.cleanup();
	    self.readyState = 'closed';
	    self.emitAll('connect_error', data);
	    if (fn) {
	      var err = new Error('Connection error');
	      err.data = data;
	      fn(err);
	    } else {
	      // Only do this if there is no fn to handle the error
	      self.maybeReconnectOnOpen();
	    }
	  });
	
	  // emit `connect_timeout`
	  if (false !== this._timeout) {
	    var timeout = this._timeout;
	    debug('connect attempt will timeout after %d', timeout);
	
	    // set timer
	    var timer = setTimeout(function () {
	      debug('connect attempt timed out after %d', timeout);
	      openSub.destroy();
	      socket.close();
	      socket.emit('error', 'timeout');
	      self.emitAll('connect_timeout', timeout);
	    }, timeout);
	
	    this.subs.push({
	      destroy: function () {
	        clearTimeout(timer);
	      }
	    });
	  }
	
	  this.subs.push(openSub);
	  this.subs.push(errorSub);
	
	  return this;
	};
	
	/**
	 * Called upon transport open.
	 *
	 * @api private
	 */
	
	Manager.prototype.onopen = function () {
	  debug('open');
	
	  // clear old subs
	  this.cleanup();
	
	  // mark as open
	  this.readyState = 'open';
	  this.emit('open');
	
	  // add new subs
	  var socket = this.engine;
	  this.subs.push(on(socket, 'data', bind(this, 'ondata')));
	  this.subs.push(on(socket, 'ping', bind(this, 'onping')));
	  this.subs.push(on(socket, 'pong', bind(this, 'onpong')));
	  this.subs.push(on(socket, 'error', bind(this, 'onerror')));
	  this.subs.push(on(socket, 'close', bind(this, 'onclose')));
	  this.subs.push(on(this.decoder, 'decoded', bind(this, 'ondecoded')));
	};
	
	/**
	 * Called upon a ping.
	 *
	 * @api private
	 */
	
	Manager.prototype.onping = function () {
	  this.lastPing = new Date();
	  this.emitAll('ping');
	};
	
	/**
	 * Called upon a packet.
	 *
	 * @api private
	 */
	
	Manager.prototype.onpong = function () {
	  this.emitAll('pong', new Date() - this.lastPing);
	};
	
	/**
	 * Called with data.
	 *
	 * @api private
	 */
	
	Manager.prototype.ondata = function (data) {
	  this.decoder.add(data);
	};
	
	/**
	 * Called when parser fully decodes a packet.
	 *
	 * @api private
	 */
	
	Manager.prototype.ondecoded = function (packet) {
	  this.emit('packet', packet);
	};
	
	/**
	 * Called upon socket error.
	 *
	 * @api private
	 */
	
	Manager.prototype.onerror = function (err) {
	  debug('error', err);
	  this.emitAll('error', err);
	};
	
	/**
	 * Creates a new socket for the given `nsp`.
	 *
	 * @return {Socket}
	 * @api public
	 */
	
	Manager.prototype.socket = function (nsp, opts) {
	  var socket = this.nsps[nsp];
	  if (!socket) {
	    socket = new Socket(this, nsp, opts);
	    this.nsps[nsp] = socket;
	    var self = this;
	    socket.on('connecting', onConnecting);
	    socket.on('connect', function () {
	      socket.id = self.generateId(nsp);
	    });
	
	    if (this.autoConnect) {
	      // manually call here since connecting event is fired before listening
	      onConnecting();
	    }
	  }
	
	  function onConnecting () {
	    if (!~indexOf(self.connecting, socket)) {
	      self.connecting.push(socket);
	    }
	  }
	
	  return socket;
	};
	
	/**
	 * Called upon a socket close.
	 *
	 * @param {Socket} socket
	 */
	
	Manager.prototype.destroy = function (socket) {
	  var index = indexOf(this.connecting, socket);
	  if (~index) this.connecting.splice(index, 1);
	  if (this.connecting.length) return;
	
	  this.close();
	};
	
	/**
	 * Writes a packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */
	
	Manager.prototype.packet = function (packet) {
	  debug('writing packet %j', packet);
	  var self = this;
	  if (packet.query && packet.type === 0) packet.nsp += '?' + packet.query;
	
	  if (!self.encoding) {
	    // encode, then write to engine with result
	    self.encoding = true;
	    this.encoder.encode(packet, function (encodedPackets) {
	      for (var i = 0; i < encodedPackets.length; i++) {
	        self.engine.write(encodedPackets[i], packet.options);
	      }
	      self.encoding = false;
	      self.processPacketQueue();
	    });
	  } else { // add packet to the queue
	    self.packetBuffer.push(packet);
	  }
	};
	
	/**
	 * If packet buffer is non-empty, begins encoding the
	 * next packet in line.
	 *
	 * @api private
	 */
	
	Manager.prototype.processPacketQueue = function () {
	  if (this.packetBuffer.length > 0 && !this.encoding) {
	    var pack = this.packetBuffer.shift();
	    this.packet(pack);
	  }
	};
	
	/**
	 * Clean up transport subscriptions and packet buffer.
	 *
	 * @api private
	 */
	
	Manager.prototype.cleanup = function () {
	  debug('cleanup');
	
	  var subsLength = this.subs.length;
	  for (var i = 0; i < subsLength; i++) {
	    var sub = this.subs.shift();
	    sub.destroy();
	  }
	
	  this.packetBuffer = [];
	  this.encoding = false;
	  this.lastPing = null;
	
	  this.decoder.destroy();
	};
	
	/**
	 * Close the current socket.
	 *
	 * @api private
	 */
	
	Manager.prototype.close =
	Manager.prototype.disconnect = function () {
	  debug('disconnect');
	  this.skipReconnect = true;
	  this.reconnecting = false;
	  if ('opening' === this.readyState) {
	    // `onclose` will not fire because
	    // an open event never happened
	    this.cleanup();
	  }
	  this.backoff.reset();
	  this.readyState = 'closed';
	  if (this.engine) this.engine.close();
	};
	
	/**
	 * Called upon engine close.
	 *
	 * @api private
	 */
	
	Manager.prototype.onclose = function (reason) {
	  debug('onclose');
	
	  this.cleanup();
	  this.backoff.reset();
	  this.readyState = 'closed';
	  this.emit('close', reason);
	
	  if (this._reconnection && !this.skipReconnect) {
	    this.reconnect();
	  }
	};
	
	/**
	 * Attempt a reconnection.
	 *
	 * @api private
	 */
	
	Manager.prototype.reconnect = function () {
	  if (this.reconnecting || this.skipReconnect) return this;
	
	  var self = this;
	
	  if (this.backoff.attempts >= this._reconnectionAttempts) {
	    debug('reconnect failed');
	    this.backoff.reset();
	    this.emitAll('reconnect_failed');
	    this.reconnecting = false;
	  } else {
	    var delay = this.backoff.duration();
	    debug('will wait %dms before reconnect attempt', delay);
	
	    this.reconnecting = true;
	    var timer = setTimeout(function () {
	      if (self.skipReconnect) return;
	
	      debug('attempting reconnect');
	      self.emitAll('reconnect_attempt', self.backoff.attempts);
	      self.emitAll('reconnecting', self.backoff.attempts);
	
	      // check again for the case socket closed in above events
	      if (self.skipReconnect) return;
	
	      self.open(function (err) {
	        if (err) {
	          debug('reconnect attempt error');
	          self.reconnecting = false;
	          self.reconnect();
	          self.emitAll('reconnect_error', err.data);
	        } else {
	          debug('reconnect success');
	          self.onreconnect();
	        }
	      });
	    }, delay);
	
	    this.subs.push({
	      destroy: function () {
	        clearTimeout(timer);
	      }
	    });
	  }
	};
	
	/**
	 * Called upon successful reconnect.
	 *
	 * @api private
	 */
	
	Manager.prototype.onreconnect = function () {
	  var attempt = this.backoff.attempts;
	  this.reconnecting = false;
	  this.backoff.reset();
	  this.updateSocketIds();
	  this.emitAll('reconnect', attempt);
	};


/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

	
	module.exports = __webpack_require__(83);


/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

	
	module.exports = __webpack_require__(84);
	
	/**
	 * Exports parser
	 *
	 * @api public
	 *
	 */
	module.exports.parser = __webpack_require__(91);


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies.
	 */
	
	var transports = __webpack_require__(85);
	var Emitter = __webpack_require__(76);
	var debug = __webpack_require__(72)('engine.io-client:socket');
	var index = __webpack_require__(106);
	var parser = __webpack_require__(91);
	var parseuri = __webpack_require__(71);
	var parsejson = __webpack_require__(107);
	var parseqs = __webpack_require__(100);
	
	/**
	 * Module exports.
	 */
	
	module.exports = Socket;
	
	/**
	 * Socket constructor.
	 *
	 * @param {String|Object} uri or options
	 * @param {Object} options
	 * @api public
	 */
	
	function Socket (uri, opts) {
	  if (!(this instanceof Socket)) return new Socket(uri, opts);
	
	  opts = opts || {};
	
	  if (uri && 'object' === typeof uri) {
	    opts = uri;
	    uri = null;
	  }
	
	  if (uri) {
	    uri = parseuri(uri);
	    opts.hostname = uri.host;
	    opts.secure = uri.protocol === 'https' || uri.protocol === 'wss';
	    opts.port = uri.port;
	    if (uri.query) opts.query = uri.query;
	  } else if (opts.host) {
	    opts.hostname = parseuri(opts.host).host;
	  }
	
	  this.secure = null != opts.secure ? opts.secure
	    : (global.location && 'https:' === location.protocol);
	
	  if (opts.hostname && !opts.port) {
	    // if no port is specified manually, use the protocol default
	    opts.port = this.secure ? '443' : '80';
	  }
	
	  this.agent = opts.agent || false;
	  this.hostname = opts.hostname ||
	    (global.location ? location.hostname : 'localhost');
	  this.port = opts.port || (global.location && location.port
	      ? location.port
	      : (this.secure ? 443 : 80));
	  this.query = opts.query || {};
	  if ('string' === typeof this.query) this.query = parseqs.decode(this.query);
	  this.upgrade = false !== opts.upgrade;
	  this.path = (opts.path || '/engine.io').replace(/\/$/, '') + '/';
	  this.forceJSONP = !!opts.forceJSONP;
	  this.jsonp = false !== opts.jsonp;
	  this.forceBase64 = !!opts.forceBase64;
	  this.enablesXDR = !!opts.enablesXDR;
	  this.timestampParam = opts.timestampParam || 't';
	  this.timestampRequests = opts.timestampRequests;
	  this.transports = opts.transports || ['polling', 'websocket'];
	  this.transportOptions = opts.transportOptions || {};
	  this.readyState = '';
	  this.writeBuffer = [];
	  this.prevBufferLen = 0;
	  this.policyPort = opts.policyPort || 843;
	  this.rememberUpgrade = opts.rememberUpgrade || false;
	  this.binaryType = null;
	  this.onlyBinaryUpgrades = opts.onlyBinaryUpgrades;
	  this.perMessageDeflate = false !== opts.perMessageDeflate ? (opts.perMessageDeflate || {}) : false;
	
	  if (true === this.perMessageDeflate) this.perMessageDeflate = {};
	  if (this.perMessageDeflate && null == this.perMessageDeflate.threshold) {
	    this.perMessageDeflate.threshold = 1024;
	  }
	
	  // SSL options for Node.js client
	  this.pfx = opts.pfx || null;
	  this.key = opts.key || null;
	  this.passphrase = opts.passphrase || null;
	  this.cert = opts.cert || null;
	  this.ca = opts.ca || null;
	  this.ciphers = opts.ciphers || null;
	  this.rejectUnauthorized = opts.rejectUnauthorized === undefined ? true : opts.rejectUnauthorized;
	  this.forceNode = !!opts.forceNode;
	
	  // other options for Node.js client
	  var freeGlobal = typeof global === 'object' && global;
	  if (freeGlobal.global === freeGlobal) {
	    if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
	      this.extraHeaders = opts.extraHeaders;
	    }
	
	    if (opts.localAddress) {
	      this.localAddress = opts.localAddress;
	    }
	  }
	
	  // set on handshake
	  this.id = null;
	  this.upgrades = null;
	  this.pingInterval = null;
	  this.pingTimeout = null;
	
	  // set on heartbeat
	  this.pingIntervalTimer = null;
	  this.pingTimeoutTimer = null;
	
	  this.open();
	}
	
	Socket.priorWebsocketSuccess = false;
	
	/**
	 * Mix in `Emitter`.
	 */
	
	Emitter(Socket.prototype);
	
	/**
	 * Protocol version.
	 *
	 * @api public
	 */
	
	Socket.protocol = parser.protocol; // this is an int
	
	/**
	 * Expose deps for legacy compatibility
	 * and standalone browser access.
	 */
	
	Socket.Socket = Socket;
	Socket.Transport = __webpack_require__(90);
	Socket.transports = __webpack_require__(85);
	Socket.parser = __webpack_require__(91);
	
	/**
	 * Creates transport of the given type.
	 *
	 * @param {String} transport name
	 * @return {Transport}
	 * @api private
	 */
	
	Socket.prototype.createTransport = function (name) {
	  debug('creating transport "%s"', name);
	  var query = clone(this.query);
	
	  // append engine.io protocol identifier
	  query.EIO = parser.protocol;
	
	  // transport name
	  query.transport = name;
	
	  // per-transport options
	  var options = this.transportOptions[name] || {};
	
	  // session id if we already have one
	  if (this.id) query.sid = this.id;
	
	  var transport = new transports[name]({
	    query: query,
	    socket: this,
	    agent: options.agent || this.agent,
	    hostname: options.hostname || this.hostname,
	    port: options.port || this.port,
	    secure: options.secure || this.secure,
	    path: options.path || this.path,
	    forceJSONP: options.forceJSONP || this.forceJSONP,
	    jsonp: options.jsonp || this.jsonp,
	    forceBase64: options.forceBase64 || this.forceBase64,
	    enablesXDR: options.enablesXDR || this.enablesXDR,
	    timestampRequests: options.timestampRequests || this.timestampRequests,
	    timestampParam: options.timestampParam || this.timestampParam,
	    policyPort: options.policyPort || this.policyPort,
	    pfx: options.pfx || this.pfx,
	    key: options.key || this.key,
	    passphrase: options.passphrase || this.passphrase,
	    cert: options.cert || this.cert,
	    ca: options.ca || this.ca,
	    ciphers: options.ciphers || this.ciphers,
	    rejectUnauthorized: options.rejectUnauthorized || this.rejectUnauthorized,
	    perMessageDeflate: options.perMessageDeflate || this.perMessageDeflate,
	    extraHeaders: options.extraHeaders || this.extraHeaders,
	    forceNode: options.forceNode || this.forceNode,
	    localAddress: options.localAddress || this.localAddress,
	    requestTimeout: options.requestTimeout || this.requestTimeout,
	    protocols: options.protocols || void (0)
	  });
	
	  return transport;
	};
	
	function clone (obj) {
	  var o = {};
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      o[i] = obj[i];
	    }
	  }
	  return o;
	}
	
	/**
	 * Initializes transport to use and starts probe.
	 *
	 * @api private
	 */
	Socket.prototype.open = function () {
	  var transport;
	  if (this.rememberUpgrade && Socket.priorWebsocketSuccess && this.transports.indexOf('websocket') !== -1) {
	    transport = 'websocket';
	  } else if (0 === this.transports.length) {
	    // Emit error on next tick so it can be listened to
	    var self = this;
	    setTimeout(function () {
	      self.emit('error', 'No transports available');
	    }, 0);
	    return;
	  } else {
	    transport = this.transports[0];
	  }
	  this.readyState = 'opening';
	
	  // Retry with the next transport if the transport is disabled (jsonp: false)
	  try {
	    transport = this.createTransport(transport);
	  } catch (e) {
	    this.transports.shift();
	    this.open();
	    return;
	  }
	
	  transport.open();
	  this.setTransport(transport);
	};
	
	/**
	 * Sets the current transport. Disables the existing one (if any).
	 *
	 * @api private
	 */
	
	Socket.prototype.setTransport = function (transport) {
	  debug('setting transport %s', transport.name);
	  var self = this;
	
	  if (this.transport) {
	    debug('clearing existing transport %s', this.transport.name);
	    this.transport.removeAllListeners();
	  }
	
	  // set up transport
	  this.transport = transport;
	
	  // set up transport listeners
	  transport
	  .on('drain', function () {
	    self.onDrain();
	  })
	  .on('packet', function (packet) {
	    self.onPacket(packet);
	  })
	  .on('error', function (e) {
	    self.onError(e);
	  })
	  .on('close', function () {
	    self.onClose('transport close');
	  });
	};
	
	/**
	 * Probes a transport.
	 *
	 * @param {String} transport name
	 * @api private
	 */
	
	Socket.prototype.probe = function (name) {
	  debug('probing transport "%s"', name);
	  var transport = this.createTransport(name, { probe: 1 });
	  var failed = false;
	  var self = this;
	
	  Socket.priorWebsocketSuccess = false;
	
	  function onTransportOpen () {
	    if (self.onlyBinaryUpgrades) {
	      var upgradeLosesBinary = !this.supportsBinary && self.transport.supportsBinary;
	      failed = failed || upgradeLosesBinary;
	    }
	    if (failed) return;
	
	    debug('probe transport "%s" opened', name);
	    transport.send([{ type: 'ping', data: 'probe' }]);
	    transport.once('packet', function (msg) {
	      if (failed) return;
	      if ('pong' === msg.type && 'probe' === msg.data) {
	        debug('probe transport "%s" pong', name);
	        self.upgrading = true;
	        self.emit('upgrading', transport);
	        if (!transport) return;
	        Socket.priorWebsocketSuccess = 'websocket' === transport.name;
	
	        debug('pausing current transport "%s"', self.transport.name);
	        self.transport.pause(function () {
	          if (failed) return;
	          if ('closed' === self.readyState) return;
	          debug('changing transport and sending upgrade packet');
	
	          cleanup();
	
	          self.setTransport(transport);
	          transport.send([{ type: 'upgrade' }]);
	          self.emit('upgrade', transport);
	          transport = null;
	          self.upgrading = false;
	          self.flush();
	        });
	      } else {
	        debug('probe transport "%s" failed', name);
	        var err = new Error('probe error');
	        err.transport = transport.name;
	        self.emit('upgradeError', err);
	      }
	    });
	  }
	
	  function freezeTransport () {
	    if (failed) return;
	
	    // Any callback called by transport should be ignored since now
	    failed = true;
	
	    cleanup();
	
	    transport.close();
	    transport = null;
	  }
	
	  // Handle any error that happens while probing
	  function onerror (err) {
	    var error = new Error('probe error: ' + err);
	    error.transport = transport.name;
	
	    freezeTransport();
	
	    debug('probe transport "%s" failed because of error: %s', name, err);
	
	    self.emit('upgradeError', error);
	  }
	
	  function onTransportClose () {
	    onerror('transport closed');
	  }
	
	  // When the socket is closed while we're probing
	  function onclose () {
	    onerror('socket closed');
	  }
	
	  // When the socket is upgraded while we're probing
	  function onupgrade (to) {
	    if (transport && to.name !== transport.name) {
	      debug('"%s" works - aborting "%s"', to.name, transport.name);
	      freezeTransport();
	    }
	  }
	
	  // Remove all listeners on the transport and on self
	  function cleanup () {
	    transport.removeListener('open', onTransportOpen);
	    transport.removeListener('error', onerror);
	    transport.removeListener('close', onTransportClose);
	    self.removeListener('close', onclose);
	    self.removeListener('upgrading', onupgrade);
	  }
	
	  transport.once('open', onTransportOpen);
	  transport.once('error', onerror);
	  transport.once('close', onTransportClose);
	
	  this.once('close', onclose);
	  this.once('upgrading', onupgrade);
	
	  transport.open();
	};
	
	/**
	 * Called when connection is deemed open.
	 *
	 * @api public
	 */
	
	Socket.prototype.onOpen = function () {
	  debug('socket open');
	  this.readyState = 'open';
	  Socket.priorWebsocketSuccess = 'websocket' === this.transport.name;
	  this.emit('open');
	  this.flush();
	
	  // we check for `readyState` in case an `open`
	  // listener already closed the socket
	  if ('open' === this.readyState && this.upgrade && this.transport.pause) {
	    debug('starting upgrade probes');
	    for (var i = 0, l = this.upgrades.length; i < l; i++) {
	      this.probe(this.upgrades[i]);
	    }
	  }
	};
	
	/**
	 * Handles a packet.
	 *
	 * @api private
	 */
	
	Socket.prototype.onPacket = function (packet) {
	  if ('opening' === this.readyState || 'open' === this.readyState ||
	      'closing' === this.readyState) {
	    debug('socket receive: type "%s", data "%s"', packet.type, packet.data);
	
	    this.emit('packet', packet);
	
	    // Socket is live - any packet counts
	    this.emit('heartbeat');
	
	    switch (packet.type) {
	      case 'open':
	        this.onHandshake(parsejson(packet.data));
	        break;
	
	      case 'pong':
	        this.setPing();
	        this.emit('pong');
	        break;
	
	      case 'error':
	        var err = new Error('server error');
	        err.code = packet.data;
	        this.onError(err);
	        break;
	
	      case 'message':
	        this.emit('data', packet.data);
	        this.emit('message', packet.data);
	        break;
	    }
	  } else {
	    debug('packet received with socket readyState "%s"', this.readyState);
	  }
	};
	
	/**
	 * Called upon handshake completion.
	 *
	 * @param {Object} handshake obj
	 * @api private
	 */
	
	Socket.prototype.onHandshake = function (data) {
	  this.emit('handshake', data);
	  this.id = data.sid;
	  this.transport.query.sid = data.sid;
	  this.upgrades = this.filterUpgrades(data.upgrades);
	  this.pingInterval = data.pingInterval;
	  this.pingTimeout = data.pingTimeout;
	  this.onOpen();
	  // In case open handler closes socket
	  if ('closed' === this.readyState) return;
	  this.setPing();
	
	  // Prolong liveness of socket on heartbeat
	  this.removeListener('heartbeat', this.onHeartbeat);
	  this.on('heartbeat', this.onHeartbeat);
	};
	
	/**
	 * Resets ping timeout.
	 *
	 * @api private
	 */
	
	Socket.prototype.onHeartbeat = function (timeout) {
	  clearTimeout(this.pingTimeoutTimer);
	  var self = this;
	  self.pingTimeoutTimer = setTimeout(function () {
	    if ('closed' === self.readyState) return;
	    self.onClose('ping timeout');
	  }, timeout || (self.pingInterval + self.pingTimeout));
	};
	
	/**
	 * Pings server every `this.pingInterval` and expects response
	 * within `this.pingTimeout` or closes connection.
	 *
	 * @api private
	 */
	
	Socket.prototype.setPing = function () {
	  var self = this;
	  clearTimeout(self.pingIntervalTimer);
	  self.pingIntervalTimer = setTimeout(function () {
	    debug('writing ping packet - expecting pong within %sms', self.pingTimeout);
	    self.ping();
	    self.onHeartbeat(self.pingTimeout);
	  }, self.pingInterval);
	};
	
	/**
	* Sends a ping packet.
	*
	* @api private
	*/
	
	Socket.prototype.ping = function () {
	  var self = this;
	  this.sendPacket('ping', function () {
	    self.emit('ping');
	  });
	};
	
	/**
	 * Called on `drain` event
	 *
	 * @api private
	 */
	
	Socket.prototype.onDrain = function () {
	  this.writeBuffer.splice(0, this.prevBufferLen);
	
	  // setting prevBufferLen = 0 is very important
	  // for example, when upgrading, upgrade packet is sent over,
	  // and a nonzero prevBufferLen could cause problems on `drain`
	  this.prevBufferLen = 0;
	
	  if (0 === this.writeBuffer.length) {
	    this.emit('drain');
	  } else {
	    this.flush();
	  }
	};
	
	/**
	 * Flush write buffers.
	 *
	 * @api private
	 */
	
	Socket.prototype.flush = function () {
	  if ('closed' !== this.readyState && this.transport.writable &&
	    !this.upgrading && this.writeBuffer.length) {
	    debug('flushing %d packets in socket', this.writeBuffer.length);
	    this.transport.send(this.writeBuffer);
	    // keep track of current length of writeBuffer
	    // splice writeBuffer and callbackBuffer on `drain`
	    this.prevBufferLen = this.writeBuffer.length;
	    this.emit('flush');
	  }
	};
	
	/**
	 * Sends a message.
	 *
	 * @param {String} message.
	 * @param {Function} callback function.
	 * @param {Object} options.
	 * @return {Socket} for chaining.
	 * @api public
	 */
	
	Socket.prototype.write =
	Socket.prototype.send = function (msg, options, fn) {
	  this.sendPacket('message', msg, options, fn);
	  return this;
	};
	
	/**
	 * Sends a packet.
	 *
	 * @param {String} packet type.
	 * @param {String} data.
	 * @param {Object} options.
	 * @param {Function} callback function.
	 * @api private
	 */
	
	Socket.prototype.sendPacket = function (type, data, options, fn) {
	  if ('function' === typeof data) {
	    fn = data;
	    data = undefined;
	  }
	
	  if ('function' === typeof options) {
	    fn = options;
	    options = null;
	  }
	
	  if ('closing' === this.readyState || 'closed' === this.readyState) {
	    return;
	  }
	
	  options = options || {};
	  options.compress = false !== options.compress;
	
	  var packet = {
	    type: type,
	    data: data,
	    options: options
	  };
	  this.emit('packetCreate', packet);
	  this.writeBuffer.push(packet);
	  if (fn) this.once('flush', fn);
	  this.flush();
	};
	
	/**
	 * Closes the connection.
	 *
	 * @api private
	 */
	
	Socket.prototype.close = function () {
	  if ('opening' === this.readyState || 'open' === this.readyState) {
	    this.readyState = 'closing';
	
	    var self = this;
	
	    if (this.writeBuffer.length) {
	      this.once('drain', function () {
	        if (this.upgrading) {
	          waitForUpgrade();
	        } else {
	          close();
	        }
	      });
	    } else if (this.upgrading) {
	      waitForUpgrade();
	    } else {
	      close();
	    }
	  }
	
	  function close () {
	    self.onClose('forced close');
	    debug('socket closing - telling transport to close');
	    self.transport.close();
	  }
	
	  function cleanupAndClose () {
	    self.removeListener('upgrade', cleanupAndClose);
	    self.removeListener('upgradeError', cleanupAndClose);
	    close();
	  }
	
	  function waitForUpgrade () {
	    // wait for upgrade to finish since we can't send packets while pausing a transport
	    self.once('upgrade', cleanupAndClose);
	    self.once('upgradeError', cleanupAndClose);
	  }
	
	  return this;
	};
	
	/**
	 * Called upon transport error
	 *
	 * @api private
	 */
	
	Socket.prototype.onError = function (err) {
	  debug('socket error %j', err);
	  Socket.priorWebsocketSuccess = false;
	  this.emit('error', err);
	  this.onClose('transport error', err);
	};
	
	/**
	 * Called upon transport close.
	 *
	 * @api private
	 */
	
	Socket.prototype.onClose = function (reason, desc) {
	  if ('opening' === this.readyState || 'open' === this.readyState || 'closing' === this.readyState) {
	    debug('socket close with reason: "%s"', reason);
	    var self = this;
	
	    // clear timers
	    clearTimeout(this.pingIntervalTimer);
	    clearTimeout(this.pingTimeoutTimer);
	
	    // stop event from firing again for transport
	    this.transport.removeAllListeners('close');
	
	    // ensure transport won't stay open
	    this.transport.close();
	
	    // ignore further transport communication
	    this.transport.removeAllListeners();
	
	    // set ready state
	    this.readyState = 'closed';
	
	    // clear session id
	    this.id = null;
	
	    // emit close event
	    this.emit('close', reason, desc);
	
	    // clean buffers after, so users can still
	    // grab the buffers on `close` event
	    self.writeBuffer = [];
	    self.prevBufferLen = 0;
	  }
	};
	
	/**
	 * Filters upgrades, returning only those matching client transports.
	 *
	 * @param {Array} server upgrades
	 * @api private
	 *
	 */
	
	Socket.prototype.filterUpgrades = function (upgrades) {
	  var filteredUpgrades = [];
	  for (var i = 0, j = upgrades.length; i < j; i++) {
	    if (~index(this.transports, upgrades[i])) filteredUpgrades.push(upgrades[i]);
	  }
	  return filteredUpgrades;
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies
	 */
	
	var XMLHttpRequest = __webpack_require__(86);
	var XHR = __webpack_require__(88);
	var JSONP = __webpack_require__(103);
	var websocket = __webpack_require__(104);
	
	/**
	 * Export transports.
	 */
	
	exports.polling = polling;
	exports.websocket = websocket;
	
	/**
	 * Polling transport polymorphic constructor.
	 * Decides on xhr vs jsonp based on feature detection.
	 *
	 * @api private
	 */
	
	function polling (opts) {
	  var xhr;
	  var xd = false;
	  var xs = false;
	  var jsonp = false !== opts.jsonp;
	
	  if (global.location) {
	    var isSSL = 'https:' === location.protocol;
	    var port = location.port;
	
	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }
	
	    xd = opts.hostname !== location.hostname || port !== opts.port;
	    xs = opts.secure !== isSSL;
	  }
	
	  opts.xdomain = xd;
	  opts.xscheme = xs;
	  xhr = new XMLHttpRequest(opts);
	
	  if ('open' in xhr && !opts.forceJSONP) {
	    return new XHR(opts);
	  } else {
	    if (!jsonp) throw new Error('JSONP disabled');
	    return new JSONP(opts);
	  }
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {// browser shim for xmlhttprequest module
	
	var hasCORS = __webpack_require__(87);
	
	module.exports = function (opts) {
	  var xdomain = opts.xdomain;
	
	  // scheme must be same when usign XDomainRequest
	  // http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx
	  var xscheme = opts.xscheme;
	
	  // XDomainRequest has a flow of not sending cookie, therefore it should be disabled as a default.
	  // https://github.com/Automattic/engine.io-client/pull/217
	  var enablesXDR = opts.enablesXDR;
	
	  // XMLHttpRequest can be disabled on IE
	  try {
	    if ('undefined' !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
	      return new XMLHttpRequest();
	    }
	  } catch (e) { }
	
	  // Use XDomainRequest for IE8 if enablesXDR is true
	  // because loading bar keeps flashing when using jsonp-polling
	  // https://github.com/yujiosaka/socke.io-ie8-loading-example
	  try {
	    if ('undefined' !== typeof XDomainRequest && !xscheme && enablesXDR) {
	      return new XDomainRequest();
	    }
	  } catch (e) { }
	
	  if (!xdomain) {
	    try {
	      return new global[['Active'].concat('Object').join('X')]('Microsoft.XMLHTTP');
	    } catch (e) { }
	  }
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 87 */
/***/ (function(module, exports) {

	
	/**
	 * Module exports.
	 *
	 * Logic borrowed from Modernizr:
	 *
	 *   - https://github.com/Modernizr/Modernizr/blob/master/feature-detects/cors.js
	 */
	
	try {
	  module.exports = typeof XMLHttpRequest !== 'undefined' &&
	    'withCredentials' in new XMLHttpRequest();
	} catch (err) {
	  // if XMLHttp support is disabled in IE then it will throw
	  // when trying to create
	  module.exports = false;
	}


/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module requirements.
	 */
	
	var XMLHttpRequest = __webpack_require__(86);
	var Polling = __webpack_require__(89);
	var Emitter = __webpack_require__(76);
	var inherit = __webpack_require__(101);
	var debug = __webpack_require__(72)('engine.io-client:polling-xhr');
	
	/**
	 * Module exports.
	 */
	
	module.exports = XHR;
	module.exports.Request = Request;
	
	/**
	 * Empty function
	 */
	
	function empty () {}
	
	/**
	 * XHR Polling constructor.
	 *
	 * @param {Object} opts
	 * @api public
	 */
	
	function XHR (opts) {
	  Polling.call(this, opts);
	  this.requestTimeout = opts.requestTimeout;
	  this.extraHeaders = opts.extraHeaders;
	
	  if (global.location) {
	    var isSSL = 'https:' === location.protocol;
	    var port = location.port;
	
	    // some user agents have empty `location.port`
	    if (!port) {
	      port = isSSL ? 443 : 80;
	    }
	
	    this.xd = opts.hostname !== global.location.hostname ||
	      port !== opts.port;
	    this.xs = opts.secure !== isSSL;
	  }
	}
	
	/**
	 * Inherits from Polling.
	 */
	
	inherit(XHR, Polling);
	
	/**
	 * XHR supports binary
	 */
	
	XHR.prototype.supportsBinary = true;
	
	/**
	 * Creates a request.
	 *
	 * @param {String} method
	 * @api private
	 */
	
	XHR.prototype.request = function (opts) {
	  opts = opts || {};
	  opts.uri = this.uri();
	  opts.xd = this.xd;
	  opts.xs = this.xs;
	  opts.agent = this.agent || false;
	  opts.supportsBinary = this.supportsBinary;
	  opts.enablesXDR = this.enablesXDR;
	
	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;
	  opts.requestTimeout = this.requestTimeout;
	
	  // other options for Node.js client
	  opts.extraHeaders = this.extraHeaders;
	
	  return new Request(opts);
	};
	
	/**
	 * Sends data.
	 *
	 * @param {String} data to send.
	 * @param {Function} called upon flush.
	 * @api private
	 */
	
	XHR.prototype.doWrite = function (data, fn) {
	  var isBinary = typeof data !== 'string' && data !== undefined;
	  var req = this.request({ method: 'POST', data: data, isBinary: isBinary });
	  var self = this;
	  req.on('success', fn);
	  req.on('error', function (err) {
	    self.onError('xhr post error', err);
	  });
	  this.sendXhr = req;
	};
	
	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */
	
	XHR.prototype.doPoll = function () {
	  debug('xhr poll');
	  var req = this.request();
	  var self = this;
	  req.on('data', function (data) {
	    self.onData(data);
	  });
	  req.on('error', function (err) {
	    self.onError('xhr poll error', err);
	  });
	  this.pollXhr = req;
	};
	
	/**
	 * Request constructor
	 *
	 * @param {Object} options
	 * @api public
	 */
	
	function Request (opts) {
	  this.method = opts.method || 'GET';
	  this.uri = opts.uri;
	  this.xd = !!opts.xd;
	  this.xs = !!opts.xs;
	  this.async = false !== opts.async;
	  this.data = undefined !== opts.data ? opts.data : null;
	  this.agent = opts.agent;
	  this.isBinary = opts.isBinary;
	  this.supportsBinary = opts.supportsBinary;
	  this.enablesXDR = opts.enablesXDR;
	  this.requestTimeout = opts.requestTimeout;
	
	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;
	
	  // other options for Node.js client
	  this.extraHeaders = opts.extraHeaders;
	
	  this.create();
	}
	
	/**
	 * Mix in `Emitter`.
	 */
	
	Emitter(Request.prototype);
	
	/**
	 * Creates the XHR object and sends the request.
	 *
	 * @api private
	 */
	
	Request.prototype.create = function () {
	  var opts = { agent: this.agent, xdomain: this.xd, xscheme: this.xs, enablesXDR: this.enablesXDR };
	
	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;
	
	  var xhr = this.xhr = new XMLHttpRequest(opts);
	  var self = this;
	
	  try {
	    debug('xhr open %s: %s', this.method, this.uri);
	    xhr.open(this.method, this.uri, this.async);
	    try {
	      if (this.extraHeaders) {
	        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
	        for (var i in this.extraHeaders) {
	          if (this.extraHeaders.hasOwnProperty(i)) {
	            xhr.setRequestHeader(i, this.extraHeaders[i]);
	          }
	        }
	      }
	    } catch (e) {}
	
	    if ('POST' === this.method) {
	      try {
	        if (this.isBinary) {
	          xhr.setRequestHeader('Content-type', 'application/octet-stream');
	        } else {
	          xhr.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
	        }
	      } catch (e) {}
	    }
	
	    try {
	      xhr.setRequestHeader('Accept', '*/*');
	    } catch (e) {}
	
	    // ie6 check
	    if ('withCredentials' in xhr) {
	      xhr.withCredentials = true;
	    }
	
	    if (this.requestTimeout) {
	      xhr.timeout = this.requestTimeout;
	    }
	
	    if (this.hasXDR()) {
	      xhr.onload = function () {
	        self.onLoad();
	      };
	      xhr.onerror = function () {
	        self.onError(xhr.responseText);
	      };
	    } else {
	      xhr.onreadystatechange = function () {
	        if (xhr.readyState === 2) {
	          var contentType;
	          try {
	            contentType = xhr.getResponseHeader('Content-Type');
	          } catch (e) {}
	          if (contentType === 'application/octet-stream') {
	            xhr.responseType = 'arraybuffer';
	          }
	        }
	        if (4 !== xhr.readyState) return;
	        if (200 === xhr.status || 1223 === xhr.status) {
	          self.onLoad();
	        } else {
	          // make sure the `error` event handler that's user-set
	          // does not throw in the same tick and gets caught here
	          setTimeout(function () {
	            self.onError(xhr.status);
	          }, 0);
	        }
	      };
	    }
	
	    debug('xhr data %s', this.data);
	    xhr.send(this.data);
	  } catch (e) {
	    // Need to defer since .create() is called directly fhrom the constructor
	    // and thus the 'error' event can only be only bound *after* this exception
	    // occurs.  Therefore, also, we cannot throw here at all.
	    setTimeout(function () {
	      self.onError(e);
	    }, 0);
	    return;
	  }
	
	  if (global.document) {
	    this.index = Request.requestsCount++;
	    Request.requests[this.index] = this;
	  }
	};
	
	/**
	 * Called upon successful response.
	 *
	 * @api private
	 */
	
	Request.prototype.onSuccess = function () {
	  this.emit('success');
	  this.cleanup();
	};
	
	/**
	 * Called if we have data.
	 *
	 * @api private
	 */
	
	Request.prototype.onData = function (data) {
	  this.emit('data', data);
	  this.onSuccess();
	};
	
	/**
	 * Called upon error.
	 *
	 * @api private
	 */
	
	Request.prototype.onError = function (err) {
	  this.emit('error', err);
	  this.cleanup(true);
	};
	
	/**
	 * Cleans up house.
	 *
	 * @api private
	 */
	
	Request.prototype.cleanup = function (fromError) {
	  if ('undefined' === typeof this.xhr || null === this.xhr) {
	    return;
	  }
	  // xmlhttprequest
	  if (this.hasXDR()) {
	    this.xhr.onload = this.xhr.onerror = empty;
	  } else {
	    this.xhr.onreadystatechange = empty;
	  }
	
	  if (fromError) {
	    try {
	      this.xhr.abort();
	    } catch (e) {}
	  }
	
	  if (global.document) {
	    delete Request.requests[this.index];
	  }
	
	  this.xhr = null;
	};
	
	/**
	 * Called upon load.
	 *
	 * @api private
	 */
	
	Request.prototype.onLoad = function () {
	  var data;
	  try {
	    var contentType;
	    try {
	      contentType = this.xhr.getResponseHeader('Content-Type');
	    } catch (e) {}
	    if (contentType === 'application/octet-stream') {
	      data = this.xhr.response || this.xhr.responseText;
	    } else {
	      data = this.xhr.responseText;
	    }
	  } catch (e) {
	    this.onError(e);
	  }
	  if (null != data) {
	    this.onData(data);
	  }
	};
	
	/**
	 * Check if it has XDomainRequest.
	 *
	 * @api private
	 */
	
	Request.prototype.hasXDR = function () {
	  return 'undefined' !== typeof global.XDomainRequest && !this.xs && this.enablesXDR;
	};
	
	/**
	 * Aborts the request.
	 *
	 * @api public
	 */
	
	Request.prototype.abort = function () {
	  this.cleanup();
	};
	
	/**
	 * Aborts pending requests when unloading the window. This is needed to prevent
	 * memory leaks (e.g. when using IE) and to ensure that no spurious error is
	 * emitted.
	 */
	
	Request.requestsCount = 0;
	Request.requests = {};
	
	if (global.document) {
	  if (global.attachEvent) {
	    global.attachEvent('onunload', unloadHandler);
	  } else if (global.addEventListener) {
	    global.addEventListener('beforeunload', unloadHandler, false);
	  }
	}
	
	function unloadHandler () {
	  for (var i in Request.requests) {
	    if (Request.requests.hasOwnProperty(i)) {
	      Request.requests[i].abort();
	    }
	  }
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */
	
	var Transport = __webpack_require__(90);
	var parseqs = __webpack_require__(100);
	var parser = __webpack_require__(91);
	var inherit = __webpack_require__(101);
	var yeast = __webpack_require__(102);
	var debug = __webpack_require__(72)('engine.io-client:polling');
	
	/**
	 * Module exports.
	 */
	
	module.exports = Polling;
	
	/**
	 * Is XHR2 supported?
	 */
	
	var hasXHR2 = (function () {
	  var XMLHttpRequest = __webpack_require__(86);
	  var xhr = new XMLHttpRequest({ xdomain: false });
	  return null != xhr.responseType;
	})();
	
	/**
	 * Polling interface.
	 *
	 * @param {Object} opts
	 * @api private
	 */
	
	function Polling (opts) {
	  var forceBase64 = (opts && opts.forceBase64);
	  if (!hasXHR2 || forceBase64) {
	    this.supportsBinary = false;
	  }
	  Transport.call(this, opts);
	}
	
	/**
	 * Inherits from Transport.
	 */
	
	inherit(Polling, Transport);
	
	/**
	 * Transport name.
	 */
	
	Polling.prototype.name = 'polling';
	
	/**
	 * Opens the socket (triggers polling). We write a PING message to determine
	 * when the transport is open.
	 *
	 * @api private
	 */
	
	Polling.prototype.doOpen = function () {
	  this.poll();
	};
	
	/**
	 * Pauses polling.
	 *
	 * @param {Function} callback upon buffers are flushed and transport is paused
	 * @api private
	 */
	
	Polling.prototype.pause = function (onPause) {
	  var self = this;
	
	  this.readyState = 'pausing';
	
	  function pause () {
	    debug('paused');
	    self.readyState = 'paused';
	    onPause();
	  }
	
	  if (this.polling || !this.writable) {
	    var total = 0;
	
	    if (this.polling) {
	      debug('we are currently polling - waiting to pause');
	      total++;
	      this.once('pollComplete', function () {
	        debug('pre-pause polling complete');
	        --total || pause();
	      });
	    }
	
	    if (!this.writable) {
	      debug('we are currently writing - waiting to pause');
	      total++;
	      this.once('drain', function () {
	        debug('pre-pause writing complete');
	        --total || pause();
	      });
	    }
	  } else {
	    pause();
	  }
	};
	
	/**
	 * Starts polling cycle.
	 *
	 * @api public
	 */
	
	Polling.prototype.poll = function () {
	  debug('polling');
	  this.polling = true;
	  this.doPoll();
	  this.emit('poll');
	};
	
	/**
	 * Overloads onData to detect payloads.
	 *
	 * @api private
	 */
	
	Polling.prototype.onData = function (data) {
	  var self = this;
	  debug('polling got data %s', data);
	  var callback = function (packet, index, total) {
	    // if its the first message we consider the transport open
	    if ('opening' === self.readyState) {
	      self.onOpen();
	    }
	
	    // if its a close packet, we close the ongoing requests
	    if ('close' === packet.type) {
	      self.onClose();
	      return false;
	    }
	
	    // otherwise bypass onData and handle the message
	    self.onPacket(packet);
	  };
	
	  // decode payload
	  parser.decodePayload(data, this.socket.binaryType, callback);
	
	  // if an event did not trigger closing
	  if ('closed' !== this.readyState) {
	    // if we got data we're not polling
	    this.polling = false;
	    this.emit('pollComplete');
	
	    if ('open' === this.readyState) {
	      this.poll();
	    } else {
	      debug('ignoring poll - transport state "%s"', this.readyState);
	    }
	  }
	};
	
	/**
	 * For polling, send a close packet.
	 *
	 * @api private
	 */
	
	Polling.prototype.doClose = function () {
	  var self = this;
	
	  function close () {
	    debug('writing close packet');
	    self.write([{ type: 'close' }]);
	  }
	
	  if ('open' === this.readyState) {
	    debug('transport open - closing');
	    close();
	  } else {
	    // in case we're trying to close while
	    // handshaking is in progress (GH-164)
	    debug('transport not open - deferring close');
	    this.once('open', close);
	  }
	};
	
	/**
	 * Writes a packets payload.
	 *
	 * @param {Array} data packets
	 * @param {Function} drain callback
	 * @api private
	 */
	
	Polling.prototype.write = function (packets) {
	  var self = this;
	  this.writable = false;
	  var callbackfn = function () {
	    self.writable = true;
	    self.emit('drain');
	  };
	
	  parser.encodePayload(packets, this.supportsBinary, function (data) {
	    self.doWrite(data, callbackfn);
	  });
	};
	
	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */
	
	Polling.prototype.uri = function () {
	  var query = this.query || {};
	  var schema = this.secure ? 'https' : 'http';
	  var port = '';
	
	  // cache busting is forced
	  if (false !== this.timestampRequests) {
	    query[this.timestampParam] = yeast();
	  }
	
	  if (!this.supportsBinary && !query.sid) {
	    query.b64 = 1;
	  }
	
	  query = parseqs.encode(query);
	
	  // avoid port if default for schema
	  if (this.port && (('https' === schema && Number(this.port) !== 443) ||
	     ('http' === schema && Number(this.port) !== 80))) {
	    port = ':' + this.port;
	  }
	
	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }
	
	  var ipv6 = this.hostname.indexOf(':') !== -1;
	  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
	};


/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */
	
	var parser = __webpack_require__(91);
	var Emitter = __webpack_require__(76);
	
	/**
	 * Module exports.
	 */
	
	module.exports = Transport;
	
	/**
	 * Transport abstract constructor.
	 *
	 * @param {Object} options.
	 * @api private
	 */
	
	function Transport (opts) {
	  this.path = opts.path;
	  this.hostname = opts.hostname;
	  this.port = opts.port;
	  this.secure = opts.secure;
	  this.query = opts.query;
	  this.timestampParam = opts.timestampParam;
	  this.timestampRequests = opts.timestampRequests;
	  this.readyState = '';
	  this.agent = opts.agent || false;
	  this.socket = opts.socket;
	  this.enablesXDR = opts.enablesXDR;
	
	  // SSL options for Node.js client
	  this.pfx = opts.pfx;
	  this.key = opts.key;
	  this.passphrase = opts.passphrase;
	  this.cert = opts.cert;
	  this.ca = opts.ca;
	  this.ciphers = opts.ciphers;
	  this.rejectUnauthorized = opts.rejectUnauthorized;
	  this.forceNode = opts.forceNode;
	
	  // other options for Node.js client
	  this.extraHeaders = opts.extraHeaders;
	  this.localAddress = opts.localAddress;
	}
	
	/**
	 * Mix in `Emitter`.
	 */
	
	Emitter(Transport.prototype);
	
	/**
	 * Emits an error.
	 *
	 * @param {String} str
	 * @return {Transport} for chaining
	 * @api public
	 */
	
	Transport.prototype.onError = function (msg, desc) {
	  var err = new Error(msg);
	  err.type = 'TransportError';
	  err.description = desc;
	  this.emit('error', err);
	  return this;
	};
	
	/**
	 * Opens the transport.
	 *
	 * @api public
	 */
	
	Transport.prototype.open = function () {
	  if ('closed' === this.readyState || '' === this.readyState) {
	    this.readyState = 'opening';
	    this.doOpen();
	  }
	
	  return this;
	};
	
	/**
	 * Closes the transport.
	 *
	 * @api private
	 */
	
	Transport.prototype.close = function () {
	  if ('opening' === this.readyState || 'open' === this.readyState) {
	    this.doClose();
	    this.onClose();
	  }
	
	  return this;
	};
	
	/**
	 * Sends multiple packets.
	 *
	 * @param {Array} packets
	 * @api private
	 */
	
	Transport.prototype.send = function (packets) {
	  if ('open' === this.readyState) {
	    this.write(packets);
	  } else {
	    throw new Error('Transport not open');
	  }
	};
	
	/**
	 * Called upon open
	 *
	 * @api private
	 */
	
	Transport.prototype.onOpen = function () {
	  this.readyState = 'open';
	  this.writable = true;
	  this.emit('open');
	};
	
	/**
	 * Called with data.
	 *
	 * @param {String} data
	 * @api private
	 */
	
	Transport.prototype.onData = function (data) {
	  var packet = parser.decodePacket(data, this.socket.binaryType);
	  this.onPacket(packet);
	};
	
	/**
	 * Called with a decoded packet.
	 */
	
	Transport.prototype.onPacket = function (packet) {
	  this.emit('packet', packet);
	};
	
	/**
	 * Called upon close.
	 *
	 * @api private
	 */
	
	Transport.prototype.onClose = function () {
	  this.readyState = 'closed';
	  this.emit('close');
	};


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies.
	 */
	
	var keys = __webpack_require__(92);
	var hasBinary = __webpack_require__(93);
	var sliceBuffer = __webpack_require__(95);
	var after = __webpack_require__(96);
	var utf8 = __webpack_require__(97);
	
	var base64encoder;
	if (global && global.ArrayBuffer) {
	  base64encoder = __webpack_require__(98);
	}
	
	/**
	 * Check if we are running an android browser. That requires us to use
	 * ArrayBuffer with polling transports...
	 *
	 * http://ghinda.net/jpeg-blob-ajax-android/
	 */
	
	var isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
	
	/**
	 * Check if we are running in PhantomJS.
	 * Uploading a Blob with PhantomJS does not work correctly, as reported here:
	 * https://github.com/ariya/phantomjs/issues/11395
	 * @type boolean
	 */
	var isPhantomJS = typeof navigator !== 'undefined' && /PhantomJS/i.test(navigator.userAgent);
	
	/**
	 * When true, avoids using Blobs to encode payloads.
	 * @type boolean
	 */
	var dontSendBlobs = isAndroid || isPhantomJS;
	
	/**
	 * Current protocol version.
	 */
	
	exports.protocol = 3;
	
	/**
	 * Packet types.
	 */
	
	var packets = exports.packets = {
	    open:     0    // non-ws
	  , close:    1    // non-ws
	  , ping:     2
	  , pong:     3
	  , message:  4
	  , upgrade:  5
	  , noop:     6
	};
	
	var packetslist = keys(packets);
	
	/**
	 * Premade error packet.
	 */
	
	var err = { type: 'error', data: 'parser error' };
	
	/**
	 * Create a blob api even for blob builder when vendor prefixes exist
	 */
	
	var Blob = __webpack_require__(99);
	
	/**
	 * Encodes a packet.
	 *
	 *     <packet type id> [ <data> ]
	 *
	 * Example:
	 *
	 *     5hello world
	 *     3
	 *     4
	 *
	 * Binary is encoded in an identical principle
	 *
	 * @api private
	 */
	
	exports.encodePacket = function (packet, supportsBinary, utf8encode, callback) {
	  if (typeof supportsBinary === 'function') {
	    callback = supportsBinary;
	    supportsBinary = false;
	  }
	
	  if (typeof utf8encode === 'function') {
	    callback = utf8encode;
	    utf8encode = null;
	  }
	
	  var data = (packet.data === undefined)
	    ? undefined
	    : packet.data.buffer || packet.data;
	
	  if (global.ArrayBuffer && data instanceof ArrayBuffer) {
	    return encodeArrayBuffer(packet, supportsBinary, callback);
	  } else if (Blob && data instanceof global.Blob) {
	    return encodeBlob(packet, supportsBinary, callback);
	  }
	
	  // might be an object with { base64: true, data: dataAsBase64String }
	  if (data && data.base64) {
	    return encodeBase64Object(packet, callback);
	  }
	
	  // Sending data as a utf-8 string
	  var encoded = packets[packet.type];
	
	  // data fragment is optional
	  if (undefined !== packet.data) {
	    encoded += utf8encode ? utf8.encode(String(packet.data), { strict: false }) : String(packet.data);
	  }
	
	  return callback('' + encoded);
	
	};
	
	function encodeBase64Object(packet, callback) {
	  // packet data is an object { base64: true, data: dataAsBase64String }
	  var message = 'b' + exports.packets[packet.type] + packet.data.data;
	  return callback(message);
	}
	
	/**
	 * Encode packet helpers for binary types
	 */
	
	function encodeArrayBuffer(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }
	
	  var data = packet.data;
	  var contentArray = new Uint8Array(data);
	  var resultBuffer = new Uint8Array(1 + data.byteLength);
	
	  resultBuffer[0] = packets[packet.type];
	  for (var i = 0; i < contentArray.length; i++) {
	    resultBuffer[i+1] = contentArray[i];
	  }
	
	  return callback(resultBuffer.buffer);
	}
	
	function encodeBlobAsArrayBuffer(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }
	
	  var fr = new FileReader();
	  fr.onload = function() {
	    packet.data = fr.result;
	    exports.encodePacket(packet, supportsBinary, true, callback);
	  };
	  return fr.readAsArrayBuffer(packet.data);
	}
	
	function encodeBlob(packet, supportsBinary, callback) {
	  if (!supportsBinary) {
	    return exports.encodeBase64Packet(packet, callback);
	  }
	
	  if (dontSendBlobs) {
	    return encodeBlobAsArrayBuffer(packet, supportsBinary, callback);
	  }
	
	  var length = new Uint8Array(1);
	  length[0] = packets[packet.type];
	  var blob = new Blob([length.buffer, packet.data]);
	
	  return callback(blob);
	}
	
	/**
	 * Encodes a packet with binary data in a base64 string
	 *
	 * @param {Object} packet, has `type` and `data`
	 * @return {String} base64 encoded message
	 */
	
	exports.encodeBase64Packet = function(packet, callback) {
	  var message = 'b' + exports.packets[packet.type];
	  if (Blob && packet.data instanceof global.Blob) {
	    var fr = new FileReader();
	    fr.onload = function() {
	      var b64 = fr.result.split(',')[1];
	      callback(message + b64);
	    };
	    return fr.readAsDataURL(packet.data);
	  }
	
	  var b64data;
	  try {
	    b64data = String.fromCharCode.apply(null, new Uint8Array(packet.data));
	  } catch (e) {
	    // iPhone Safari doesn't let you apply with typed arrays
	    var typed = new Uint8Array(packet.data);
	    var basic = new Array(typed.length);
	    for (var i = 0; i < typed.length; i++) {
	      basic[i] = typed[i];
	    }
	    b64data = String.fromCharCode.apply(null, basic);
	  }
	  message += global.btoa(b64data);
	  return callback(message);
	};
	
	/**
	 * Decodes a packet. Changes format to Blob if requested.
	 *
	 * @return {Object} with `type` and `data` (if any)
	 * @api private
	 */
	
	exports.decodePacket = function (data, binaryType, utf8decode) {
	  if (data === undefined) {
	    return err;
	  }
	  // String data
	  if (typeof data === 'string') {
	    if (data.charAt(0) === 'b') {
	      return exports.decodeBase64Packet(data.substr(1), binaryType);
	    }
	
	    if (utf8decode) {
	      data = tryDecode(data);
	      if (data === false) {
	        return err;
	      }
	    }
	    var type = data.charAt(0);
	
	    if (Number(type) != type || !packetslist[type]) {
	      return err;
	    }
	
	    if (data.length > 1) {
	      return { type: packetslist[type], data: data.substring(1) };
	    } else {
	      return { type: packetslist[type] };
	    }
	  }
	
	  var asArray = new Uint8Array(data);
	  var type = asArray[0];
	  var rest = sliceBuffer(data, 1);
	  if (Blob && binaryType === 'blob') {
	    rest = new Blob([rest]);
	  }
	  return { type: packetslist[type], data: rest };
	};
	
	function tryDecode(data) {
	  try {
	    data = utf8.decode(data, { strict: false });
	  } catch (e) {
	    return false;
	  }
	  return data;
	}
	
	/**
	 * Decodes a packet encoded in a base64 string
	 *
	 * @param {String} base64 encoded message
	 * @return {Object} with `type` and `data` (if any)
	 */
	
	exports.decodeBase64Packet = function(msg, binaryType) {
	  var type = packetslist[msg.charAt(0)];
	  if (!base64encoder) {
	    return { type: type, data: { base64: true, data: msg.substr(1) } };
	  }
	
	  var data = base64encoder.decode(msg.substr(1));
	
	  if (binaryType === 'blob' && Blob) {
	    data = new Blob([data]);
	  }
	
	  return { type: type, data: data };
	};
	
	/**
	 * Encodes multiple messages (payload).
	 *
	 *     <length>:data
	 *
	 * Example:
	 *
	 *     11:hello world2:hi
	 *
	 * If any contents are binary, they will be encoded as base64 strings. Base64
	 * encoded strings are marked with a b before the length specifier
	 *
	 * @param {Array} packets
	 * @api private
	 */
	
	exports.encodePayload = function (packets, supportsBinary, callback) {
	  if (typeof supportsBinary === 'function') {
	    callback = supportsBinary;
	    supportsBinary = null;
	  }
	
	  var isBinary = hasBinary(packets);
	
	  if (supportsBinary && isBinary) {
	    if (Blob && !dontSendBlobs) {
	      return exports.encodePayloadAsBlob(packets, callback);
	    }
	
	    return exports.encodePayloadAsArrayBuffer(packets, callback);
	  }
	
	  if (!packets.length) {
	    return callback('0:');
	  }
	
	  function setLengthHeader(message) {
	    return message.length + ':' + message;
	  }
	
	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, !isBinary ? false : supportsBinary, false, function(message) {
	      doneCallback(null, setLengthHeader(message));
	    });
	  }
	
	  map(packets, encodeOne, function(err, results) {
	    return callback(results.join(''));
	  });
	};
	
	/**
	 * Async array map using after
	 */
	
	function map(ary, each, done) {
	  var result = new Array(ary.length);
	  var next = after(ary.length, done);
	
	  var eachWithIndex = function(i, el, cb) {
	    each(el, function(error, msg) {
	      result[i] = msg;
	      cb(error, result);
	    });
	  };
	
	  for (var i = 0; i < ary.length; i++) {
	    eachWithIndex(i, ary[i], next);
	  }
	}
	
	/*
	 * Decodes data when a payload is maybe expected. Possible binary contents are
	 * decoded from their base64 representation
	 *
	 * @param {String} data, callback method
	 * @api public
	 */
	
	exports.decodePayload = function (data, binaryType, callback) {
	  if (typeof data !== 'string') {
	    return exports.decodePayloadAsBinary(data, binaryType, callback);
	  }
	
	  if (typeof binaryType === 'function') {
	    callback = binaryType;
	    binaryType = null;
	  }
	
	  var packet;
	  if (data === '') {
	    // parser error - ignoring payload
	    return callback(err, 0, 1);
	  }
	
	  var length = '', n, msg;
	
	  for (var i = 0, l = data.length; i < l; i++) {
	    var chr = data.charAt(i);
	
	    if (chr !== ':') {
	      length += chr;
	      continue;
	    }
	
	    if (length === '' || (length != (n = Number(length)))) {
	      // parser error - ignoring payload
	      return callback(err, 0, 1);
	    }
	
	    msg = data.substr(i + 1, n);
	
	    if (length != msg.length) {
	      // parser error - ignoring payload
	      return callback(err, 0, 1);
	    }
	
	    if (msg.length) {
	      packet = exports.decodePacket(msg, binaryType, false);
	
	      if (err.type === packet.type && err.data === packet.data) {
	        // parser error in individual packet - ignoring payload
	        return callback(err, 0, 1);
	      }
	
	      var ret = callback(packet, i + n, l);
	      if (false === ret) return;
	    }
	
	    // advance cursor
	    i += n;
	    length = '';
	  }
	
	  if (length !== '') {
	    // parser error - ignoring payload
	    return callback(err, 0, 1);
	  }
	
	};
	
	/**
	 * Encodes multiple messages (payload) as binary.
	 *
	 * <1 = binary, 0 = string><number from 0-9><number from 0-9>[...]<number
	 * 255><data>
	 *
	 * Example:
	 * 1 3 255 1 2 3, if the binary contents are interpreted as 8 bit integers
	 *
	 * @param {Array} packets
	 * @return {ArrayBuffer} encoded payload
	 * @api private
	 */
	
	exports.encodePayloadAsArrayBuffer = function(packets, callback) {
	  if (!packets.length) {
	    return callback(new ArrayBuffer(0));
	  }
	
	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, true, true, function(data) {
	      return doneCallback(null, data);
	    });
	  }
	
	  map(packets, encodeOne, function(err, encodedPackets) {
	    var totalLength = encodedPackets.reduce(function(acc, p) {
	      var len;
	      if (typeof p === 'string'){
	        len = p.length;
	      } else {
	        len = p.byteLength;
	      }
	      return acc + len.toString().length + len + 2; // string/binary identifier + separator = 2
	    }, 0);
	
	    var resultArray = new Uint8Array(totalLength);
	
	    var bufferIndex = 0;
	    encodedPackets.forEach(function(p) {
	      var isString = typeof p === 'string';
	      var ab = p;
	      if (isString) {
	        var view = new Uint8Array(p.length);
	        for (var i = 0; i < p.length; i++) {
	          view[i] = p.charCodeAt(i);
	        }
	        ab = view.buffer;
	      }
	
	      if (isString) { // not true binary
	        resultArray[bufferIndex++] = 0;
	      } else { // true binary
	        resultArray[bufferIndex++] = 1;
	      }
	
	      var lenStr = ab.byteLength.toString();
	      for (var i = 0; i < lenStr.length; i++) {
	        resultArray[bufferIndex++] = parseInt(lenStr[i]);
	      }
	      resultArray[bufferIndex++] = 255;
	
	      var view = new Uint8Array(ab);
	      for (var i = 0; i < view.length; i++) {
	        resultArray[bufferIndex++] = view[i];
	      }
	    });
	
	    return callback(resultArray.buffer);
	  });
	};
	
	/**
	 * Encode as Blob
	 */
	
	exports.encodePayloadAsBlob = function(packets, callback) {
	  function encodeOne(packet, doneCallback) {
	    exports.encodePacket(packet, true, true, function(encoded) {
	      var binaryIdentifier = new Uint8Array(1);
	      binaryIdentifier[0] = 1;
	      if (typeof encoded === 'string') {
	        var view = new Uint8Array(encoded.length);
	        for (var i = 0; i < encoded.length; i++) {
	          view[i] = encoded.charCodeAt(i);
	        }
	        encoded = view.buffer;
	        binaryIdentifier[0] = 0;
	      }
	
	      var len = (encoded instanceof ArrayBuffer)
	        ? encoded.byteLength
	        : encoded.size;
	
	      var lenStr = len.toString();
	      var lengthAry = new Uint8Array(lenStr.length + 1);
	      for (var i = 0; i < lenStr.length; i++) {
	        lengthAry[i] = parseInt(lenStr[i]);
	      }
	      lengthAry[lenStr.length] = 255;
	
	      if (Blob) {
	        var blob = new Blob([binaryIdentifier.buffer, lengthAry.buffer, encoded]);
	        doneCallback(null, blob);
	      }
	    });
	  }
	
	  map(packets, encodeOne, function(err, results) {
	    return callback(new Blob(results));
	  });
	};
	
	/*
	 * Decodes data when a payload is maybe expected. Strings are decoded by
	 * interpreting each byte as a key code for entries marked to start with 0. See
	 * description of encodePayloadAsBinary
	 *
	 * @param {ArrayBuffer} data, callback method
	 * @api public
	 */
	
	exports.decodePayloadAsBinary = function (data, binaryType, callback) {
	  if (typeof binaryType === 'function') {
	    callback = binaryType;
	    binaryType = null;
	  }
	
	  var bufferTail = data;
	  var buffers = [];
	
	  while (bufferTail.byteLength > 0) {
	    var tailArray = new Uint8Array(bufferTail);
	    var isString = tailArray[0] === 0;
	    var msgLength = '';
	
	    for (var i = 1; ; i++) {
	      if (tailArray[i] === 255) break;
	
	      // 310 = char length of Number.MAX_VALUE
	      if (msgLength.length > 310) {
	        return callback(err, 0, 1);
	      }
	
	      msgLength += tailArray[i];
	    }
	
	    bufferTail = sliceBuffer(bufferTail, 2 + msgLength.length);
	    msgLength = parseInt(msgLength);
	
	    var msg = sliceBuffer(bufferTail, 0, msgLength);
	    if (isString) {
	      try {
	        msg = String.fromCharCode.apply(null, new Uint8Array(msg));
	      } catch (e) {
	        // iPhone Safari doesn't let you apply to typed arrays
	        var typed = new Uint8Array(msg);
	        msg = '';
	        for (var i = 0; i < typed.length; i++) {
	          msg += String.fromCharCode(typed[i]);
	        }
	      }
	    }
	
	    buffers.push(msg);
	    bufferTail = sliceBuffer(bufferTail, msgLength);
	  }
	
	  var total = buffers.length;
	  buffers.forEach(function(buffer, i) {
	    callback(exports.decodePacket(buffer, binaryType, true), i, total);
	  });
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 92 */
/***/ (function(module, exports) {

	
	/**
	 * Gets the keys for an object.
	 *
	 * @return {Array} keys
	 * @api private
	 */
	
	module.exports = Object.keys || function keys (obj){
	  var arr = [];
	  var has = Object.prototype.hasOwnProperty;
	
	  for (var i in obj) {
	    if (has.call(obj, i)) {
	      arr.push(i);
	    }
	  }
	  return arr;
	};


/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/* global Blob File */
	
	/*
	 * Module requirements.
	 */
	
	var isArray = __webpack_require__(94);
	
	var toString = Object.prototype.toString;
	var withNativeBlob = typeof global.Blob === 'function' || toString.call(global.Blob) === '[object BlobConstructor]';
	var withNativeFile = typeof global.File === 'function' || toString.call(global.File) === '[object FileConstructor]';
	
	/**
	 * Module exports.
	 */
	
	module.exports = hasBinary;
	
	/**
	 * Checks for binary data.
	 *
	 * Supports Buffer, ArrayBuffer, Blob and File.
	 *
	 * @param {Object} anything
	 * @api public
	 */
	
	function hasBinary (obj) {
	  if (!obj || typeof obj !== 'object') {
	    return false;
	  }
	
	  if (isArray(obj)) {
	    for (var i = 0, l = obj.length; i < l; i++) {
	      if (hasBinary(obj[i])) {
	        return true;
	      }
	    }
	    return false;
	  }
	
	  if ((typeof global.Buffer === 'function' && global.Buffer.isBuffer && global.Buffer.isBuffer(obj)) ||
	     (typeof global.ArrayBuffer === 'function' && obj instanceof ArrayBuffer) ||
	     (withNativeBlob && obj instanceof Blob) ||
	     (withNativeFile && obj instanceof File)
	    ) {
	    return true;
	  }
	
	  // see: https://github.com/Automattic/has-binary/pull/4
	  if (obj.toJSON && typeof obj.toJSON === 'function' && arguments.length === 1) {
	    return hasBinary(obj.toJSON(), true);
	  }
	
	  for (var key in obj) {
	    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
	      return true;
	    }
	  }
	
	  return false;
	}
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 94 */
/***/ (function(module, exports) {

	var toString = {}.toString;
	
	module.exports = Array.isArray || function (arr) {
	  return toString.call(arr) == '[object Array]';
	};


/***/ }),
/* 95 */
/***/ (function(module, exports) {

	/**
	 * An abstraction for slicing an arraybuffer even when
	 * ArrayBuffer.prototype.slice is not supported
	 *
	 * @api public
	 */
	
	module.exports = function(arraybuffer, start, end) {
	  var bytes = arraybuffer.byteLength;
	  start = start || 0;
	  end = end || bytes;
	
	  if (arraybuffer.slice) { return arraybuffer.slice(start, end); }
	
	  if (start < 0) { start += bytes; }
	  if (end < 0) { end += bytes; }
	  if (end > bytes) { end = bytes; }
	
	  if (start >= bytes || start >= end || bytes === 0) {
	    return new ArrayBuffer(0);
	  }
	
	  var abv = new Uint8Array(arraybuffer);
	  var result = new Uint8Array(end - start);
	  for (var i = start, ii = 0; i < end; i++, ii++) {
	    result[ii] = abv[i];
	  }
	  return result.buffer;
	};


/***/ }),
/* 96 */
/***/ (function(module, exports) {

	module.exports = after
	
	function after(count, callback, err_cb) {
	    var bail = false
	    err_cb = err_cb || noop
	    proxy.count = count
	
	    return (count === 0) ? callback() : proxy
	
	    function proxy(err, result) {
	        if (proxy.count <= 0) {
	            throw new Error('after called too many times')
	        }
	        --proxy.count
	
	        // after first error, rest are passed to err_cb
	        if (err) {
	            bail = true
	            callback(err)
	            // future error callbacks will go to error handler
	            callback = err_cb
	        } else if (proxy.count === 0 && !bail) {
	            callback(null, result)
	        }
	    }
	}
	
	function noop() {}


/***/ }),
/* 97 */
/***/ (function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module, global) {/*! https://mths.be/utf8js v2.1.2 by @mathias */
	;(function(root) {
	
		// Detect free variables `exports`
		var freeExports = typeof exports == 'object' && exports;
	
		// Detect free variable `module`
		var freeModule = typeof module == 'object' && module &&
			module.exports == freeExports && module;
	
		// Detect free variable `global`, from Node.js or Browserified code,
		// and use it as `root`
		var freeGlobal = typeof global == 'object' && global;
		if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
			root = freeGlobal;
		}
	
		/*--------------------------------------------------------------------------*/
	
		var stringFromCharCode = String.fromCharCode;
	
		// Taken from https://mths.be/punycode
		function ucs2decode(string) {
			var output = [];
			var counter = 0;
			var length = string.length;
			var value;
			var extra;
			while (counter < length) {
				value = string.charCodeAt(counter++);
				if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
					// high surrogate, and there is a next character
					extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // low surrogate
						output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
					} else {
						// unmatched surrogate; only append this code unit, in case the next
						// code unit is the high surrogate of a surrogate pair
						output.push(value);
						counter--;
					}
				} else {
					output.push(value);
				}
			}
			return output;
		}
	
		// Taken from https://mths.be/punycode
		function ucs2encode(array) {
			var length = array.length;
			var index = -1;
			var value;
			var output = '';
			while (++index < length) {
				value = array[index];
				if (value > 0xFFFF) {
					value -= 0x10000;
					output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
					value = 0xDC00 | value & 0x3FF;
				}
				output += stringFromCharCode(value);
			}
			return output;
		}
	
		function checkScalarValue(codePoint, strict) {
			if (codePoint >= 0xD800 && codePoint <= 0xDFFF) {
				if (strict) {
					throw Error(
						'Lone surrogate U+' + codePoint.toString(16).toUpperCase() +
						' is not a scalar value'
					);
				}
				return false;
			}
			return true;
		}
		/*--------------------------------------------------------------------------*/
	
		function createByte(codePoint, shift) {
			return stringFromCharCode(((codePoint >> shift) & 0x3F) | 0x80);
		}
	
		function encodeCodePoint(codePoint, strict) {
			if ((codePoint & 0xFFFFFF80) == 0) { // 1-byte sequence
				return stringFromCharCode(codePoint);
			}
			var symbol = '';
			if ((codePoint & 0xFFFFF800) == 0) { // 2-byte sequence
				symbol = stringFromCharCode(((codePoint >> 6) & 0x1F) | 0xC0);
			}
			else if ((codePoint & 0xFFFF0000) == 0) { // 3-byte sequence
				if (!checkScalarValue(codePoint, strict)) {
					codePoint = 0xFFFD;
				}
				symbol = stringFromCharCode(((codePoint >> 12) & 0x0F) | 0xE0);
				symbol += createByte(codePoint, 6);
			}
			else if ((codePoint & 0xFFE00000) == 0) { // 4-byte sequence
				symbol = stringFromCharCode(((codePoint >> 18) & 0x07) | 0xF0);
				symbol += createByte(codePoint, 12);
				symbol += createByte(codePoint, 6);
			}
			symbol += stringFromCharCode((codePoint & 0x3F) | 0x80);
			return symbol;
		}
	
		function utf8encode(string, opts) {
			opts = opts || {};
			var strict = false !== opts.strict;
	
			var codePoints = ucs2decode(string);
			var length = codePoints.length;
			var index = -1;
			var codePoint;
			var byteString = '';
			while (++index < length) {
				codePoint = codePoints[index];
				byteString += encodeCodePoint(codePoint, strict);
			}
			return byteString;
		}
	
		/*--------------------------------------------------------------------------*/
	
		function readContinuationByte() {
			if (byteIndex >= byteCount) {
				throw Error('Invalid byte index');
			}
	
			var continuationByte = byteArray[byteIndex] & 0xFF;
			byteIndex++;
	
			if ((continuationByte & 0xC0) == 0x80) {
				return continuationByte & 0x3F;
			}
	
			// If we end up here, it’s not a continuation byte
			throw Error('Invalid continuation byte');
		}
	
		function decodeSymbol(strict) {
			var byte1;
			var byte2;
			var byte3;
			var byte4;
			var codePoint;
	
			if (byteIndex > byteCount) {
				throw Error('Invalid byte index');
			}
	
			if (byteIndex == byteCount) {
				return false;
			}
	
			// Read first byte
			byte1 = byteArray[byteIndex] & 0xFF;
			byteIndex++;
	
			// 1-byte sequence (no continuation bytes)
			if ((byte1 & 0x80) == 0) {
				return byte1;
			}
	
			// 2-byte sequence
			if ((byte1 & 0xE0) == 0xC0) {
				byte2 = readContinuationByte();
				codePoint = ((byte1 & 0x1F) << 6) | byte2;
				if (codePoint >= 0x80) {
					return codePoint;
				} else {
					throw Error('Invalid continuation byte');
				}
			}
	
			// 3-byte sequence (may include unpaired surrogates)
			if ((byte1 & 0xF0) == 0xE0) {
				byte2 = readContinuationByte();
				byte3 = readContinuationByte();
				codePoint = ((byte1 & 0x0F) << 12) | (byte2 << 6) | byte3;
				if (codePoint >= 0x0800) {
					return checkScalarValue(codePoint, strict) ? codePoint : 0xFFFD;
				} else {
					throw Error('Invalid continuation byte');
				}
			}
	
			// 4-byte sequence
			if ((byte1 & 0xF8) == 0xF0) {
				byte2 = readContinuationByte();
				byte3 = readContinuationByte();
				byte4 = readContinuationByte();
				codePoint = ((byte1 & 0x07) << 0x12) | (byte2 << 0x0C) |
					(byte3 << 0x06) | byte4;
				if (codePoint >= 0x010000 && codePoint <= 0x10FFFF) {
					return codePoint;
				}
			}
	
			throw Error('Invalid UTF-8 detected');
		}
	
		var byteArray;
		var byteCount;
		var byteIndex;
		function utf8decode(byteString, opts) {
			opts = opts || {};
			var strict = false !== opts.strict;
	
			byteArray = ucs2decode(byteString);
			byteCount = byteArray.length;
			byteIndex = 0;
			var codePoints = [];
			var tmp;
			while ((tmp = decodeSymbol(strict)) !== false) {
				codePoints.push(tmp);
			}
			return ucs2encode(codePoints);
		}
	
		/*--------------------------------------------------------------------------*/
	
		var utf8 = {
			'version': '2.1.2',
			'encode': utf8encode,
			'decode': utf8decode
		};
	
		// Some AMD build optimizers, like r.js, check for specific condition patterns
		// like the following:
		if (
			true
		) {
			!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
				return utf8;
			}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		}	else if (freeExports && !freeExports.nodeType) {
			if (freeModule) { // in Node.js or RingoJS v0.8.0+
				freeModule.exports = utf8;
			} else { // in Narwhal or RingoJS v0.7.0-
				var object = {};
				var hasOwnProperty = object.hasOwnProperty;
				for (var key in utf8) {
					hasOwnProperty.call(utf8, key) && (freeExports[key] = utf8[key]);
				}
			}
		} else { // in Rhino or a web browser
			root.utf8 = utf8;
		}
	
	}(this));
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(42)(module), (function() { return this; }())))

/***/ }),
/* 98 */
/***/ (function(module, exports) {

	/*
	 * base64-arraybuffer
	 * https://github.com/niklasvh/base64-arraybuffer
	 *
	 * Copyright (c) 2012 Niklas von Hertzen
	 * Licensed under the MIT license.
	 */
	(function(){
	  "use strict";
	
	  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	
	  // Use a lookup table to find the index.
	  var lookup = new Uint8Array(256);
	  for (var i = 0; i < chars.length; i++) {
	    lookup[chars.charCodeAt(i)] = i;
	  }
	
	  exports.encode = function(arraybuffer) {
	    var bytes = new Uint8Array(arraybuffer),
	    i, len = bytes.length, base64 = "";
	
	    for (i = 0; i < len; i+=3) {
	      base64 += chars[bytes[i] >> 2];
	      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
	      base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
	      base64 += chars[bytes[i + 2] & 63];
	    }
	
	    if ((len % 3) === 2) {
	      base64 = base64.substring(0, base64.length - 1) + "=";
	    } else if (len % 3 === 1) {
	      base64 = base64.substring(0, base64.length - 2) + "==";
	    }
	
	    return base64;
	  };
	
	  exports.decode =  function(base64) {
	    var bufferLength = base64.length * 0.75,
	    len = base64.length, i, p = 0,
	    encoded1, encoded2, encoded3, encoded4;
	
	    if (base64[base64.length - 1] === "=") {
	      bufferLength--;
	      if (base64[base64.length - 2] === "=") {
	        bufferLength--;
	      }
	    }
	
	    var arraybuffer = new ArrayBuffer(bufferLength),
	    bytes = new Uint8Array(arraybuffer);
	
	    for (i = 0; i < len; i+=4) {
	      encoded1 = lookup[base64.charCodeAt(i)];
	      encoded2 = lookup[base64.charCodeAt(i+1)];
	      encoded3 = lookup[base64.charCodeAt(i+2)];
	      encoded4 = lookup[base64.charCodeAt(i+3)];
	
	      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
	      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
	      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
	    }
	
	    return arraybuffer;
	  };
	})();


/***/ }),
/* 99 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Create a blob builder even when vendor prefixes exist
	 */
	
	var BlobBuilder = global.BlobBuilder
	  || global.WebKitBlobBuilder
	  || global.MSBlobBuilder
	  || global.MozBlobBuilder;
	
	/**
	 * Check if Blob constructor is supported
	 */
	
	var blobSupported = (function() {
	  try {
	    var a = new Blob(['hi']);
	    return a.size === 2;
	  } catch(e) {
	    return false;
	  }
	})();
	
	/**
	 * Check if Blob constructor supports ArrayBufferViews
	 * Fails in Safari 6, so we need to map to ArrayBuffers there.
	 */
	
	var blobSupportsArrayBufferView = blobSupported && (function() {
	  try {
	    var b = new Blob([new Uint8Array([1,2])]);
	    return b.size === 2;
	  } catch(e) {
	    return false;
	  }
	})();
	
	/**
	 * Check if BlobBuilder is supported
	 */
	
	var blobBuilderSupported = BlobBuilder
	  && BlobBuilder.prototype.append
	  && BlobBuilder.prototype.getBlob;
	
	/**
	 * Helper function that maps ArrayBufferViews to ArrayBuffers
	 * Used by BlobBuilder constructor and old browsers that didn't
	 * support it in the Blob constructor.
	 */
	
	function mapArrayBufferViews(ary) {
	  for (var i = 0; i < ary.length; i++) {
	    var chunk = ary[i];
	    if (chunk.buffer instanceof ArrayBuffer) {
	      var buf = chunk.buffer;
	
	      // if this is a subarray, make a copy so we only
	      // include the subarray region from the underlying buffer
	      if (chunk.byteLength !== buf.byteLength) {
	        var copy = new Uint8Array(chunk.byteLength);
	        copy.set(new Uint8Array(buf, chunk.byteOffset, chunk.byteLength));
	        buf = copy.buffer;
	      }
	
	      ary[i] = buf;
	    }
	  }
	}
	
	function BlobBuilderConstructor(ary, options) {
	  options = options || {};
	
	  var bb = new BlobBuilder();
	  mapArrayBufferViews(ary);
	
	  for (var i = 0; i < ary.length; i++) {
	    bb.append(ary[i]);
	  }
	
	  return (options.type) ? bb.getBlob(options.type) : bb.getBlob();
	};
	
	function BlobConstructor(ary, options) {
	  mapArrayBufferViews(ary);
	  return new Blob(ary, options || {});
	};
	
	module.exports = (function() {
	  if (blobSupported) {
	    return blobSupportsArrayBufferView ? global.Blob : BlobConstructor;
	  } else if (blobBuilderSupported) {
	    return BlobBuilderConstructor;
	  } else {
	    return undefined;
	  }
	})();
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 100 */
/***/ (function(module, exports) {

	/**
	 * Compiles a querystring
	 * Returns string representation of the object
	 *
	 * @param {Object}
	 * @api private
	 */
	
	exports.encode = function (obj) {
	  var str = '';
	
	  for (var i in obj) {
	    if (obj.hasOwnProperty(i)) {
	      if (str.length) str += '&';
	      str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
	    }
	  }
	
	  return str;
	};
	
	/**
	 * Parses a simple querystring into an object
	 *
	 * @param {String} qs
	 * @api private
	 */
	
	exports.decode = function(qs){
	  var qry = {};
	  var pairs = qs.split('&');
	  for (var i = 0, l = pairs.length; i < l; i++) {
	    var pair = pairs[i].split('=');
	    qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
	  }
	  return qry;
	};


/***/ }),
/* 101 */
/***/ (function(module, exports) {

	
	module.exports = function(a, b){
	  var fn = function(){};
	  fn.prototype = b.prototype;
	  a.prototype = new fn;
	  a.prototype.constructor = a;
	};

/***/ }),
/* 102 */
/***/ (function(module, exports) {

	'use strict';
	
	var alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'.split('')
	  , length = 64
	  , map = {}
	  , seed = 0
	  , i = 0
	  , prev;
	
	/**
	 * Return a string representing the specified number.
	 *
	 * @param {Number} num The number to convert.
	 * @returns {String} The string representation of the number.
	 * @api public
	 */
	function encode(num) {
	  var encoded = '';
	
	  do {
	    encoded = alphabet[num % length] + encoded;
	    num = Math.floor(num / length);
	  } while (num > 0);
	
	  return encoded;
	}
	
	/**
	 * Return the integer value specified by the given string.
	 *
	 * @param {String} str The string to convert.
	 * @returns {Number} The integer value represented by the string.
	 * @api public
	 */
	function decode(str) {
	  var decoded = 0;
	
	  for (i = 0; i < str.length; i++) {
	    decoded = decoded * length + map[str.charAt(i)];
	  }
	
	  return decoded;
	}
	
	/**
	 * Yeast: A tiny growing id generator.
	 *
	 * @returns {String} A unique id.
	 * @api public
	 */
	function yeast() {
	  var now = encode(+new Date());
	
	  if (now !== prev) return seed = 0, prev = now;
	  return now +'.'+ encode(seed++);
	}
	
	//
	// Map each character to its index.
	//
	for (; i < length; i++) map[alphabet[i]] = i;
	
	//
	// Expose the `yeast`, `encode` and `decode` functions.
	//
	yeast.encode = encode;
	yeast.decode = decode;
	module.exports = yeast;


/***/ }),
/* 103 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {
	/**
	 * Module requirements.
	 */
	
	var Polling = __webpack_require__(89);
	var inherit = __webpack_require__(101);
	
	/**
	 * Module exports.
	 */
	
	module.exports = JSONPPolling;
	
	/**
	 * Cached regular expressions.
	 */
	
	var rNewline = /\n/g;
	var rEscapedNewline = /\\n/g;
	
	/**
	 * Global JSONP callbacks.
	 */
	
	var callbacks;
	
	/**
	 * Noop.
	 */
	
	function empty () { }
	
	/**
	 * JSONP Polling constructor.
	 *
	 * @param {Object} opts.
	 * @api public
	 */
	
	function JSONPPolling (opts) {
	  Polling.call(this, opts);
	
	  this.query = this.query || {};
	
	  // define global callbacks array if not present
	  // we do this here (lazily) to avoid unneeded global pollution
	  if (!callbacks) {
	    // we need to consider multiple engines in the same page
	    if (!global.___eio) global.___eio = [];
	    callbacks = global.___eio;
	  }
	
	  // callback identifier
	  this.index = callbacks.length;
	
	  // add callback to jsonp global
	  var self = this;
	  callbacks.push(function (msg) {
	    self.onData(msg);
	  });
	
	  // append to query string
	  this.query.j = this.index;
	
	  // prevent spurious errors from being emitted when the window is unloaded
	  if (global.document && global.addEventListener) {
	    global.addEventListener('beforeunload', function () {
	      if (self.script) self.script.onerror = empty;
	    }, false);
	  }
	}
	
	/**
	 * Inherits from Polling.
	 */
	
	inherit(JSONPPolling, Polling);
	
	/*
	 * JSONP only supports binary as base64 encoded strings
	 */
	
	JSONPPolling.prototype.supportsBinary = false;
	
	/**
	 * Closes the socket.
	 *
	 * @api private
	 */
	
	JSONPPolling.prototype.doClose = function () {
	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }
	
	  if (this.form) {
	    this.form.parentNode.removeChild(this.form);
	    this.form = null;
	    this.iframe = null;
	  }
	
	  Polling.prototype.doClose.call(this);
	};
	
	/**
	 * Starts a poll cycle.
	 *
	 * @api private
	 */
	
	JSONPPolling.prototype.doPoll = function () {
	  var self = this;
	  var script = document.createElement('script');
	
	  if (this.script) {
	    this.script.parentNode.removeChild(this.script);
	    this.script = null;
	  }
	
	  script.async = true;
	  script.src = this.uri();
	  script.onerror = function (e) {
	    self.onError('jsonp poll error', e);
	  };
	
	  var insertAt = document.getElementsByTagName('script')[0];
	  if (insertAt) {
	    insertAt.parentNode.insertBefore(script, insertAt);
	  } else {
	    (document.head || document.body).appendChild(script);
	  }
	  this.script = script;
	
	  var isUAgecko = 'undefined' !== typeof navigator && /gecko/i.test(navigator.userAgent);
	
	  if (isUAgecko) {
	    setTimeout(function () {
	      var iframe = document.createElement('iframe');
	      document.body.appendChild(iframe);
	      document.body.removeChild(iframe);
	    }, 100);
	  }
	};
	
	/**
	 * Writes with a hidden iframe.
	 *
	 * @param {String} data to send
	 * @param {Function} called upon flush.
	 * @api private
	 */
	
	JSONPPolling.prototype.doWrite = function (data, fn) {
	  var self = this;
	
	  if (!this.form) {
	    var form = document.createElement('form');
	    var area = document.createElement('textarea');
	    var id = this.iframeId = 'eio_iframe_' + this.index;
	    var iframe;
	
	    form.className = 'socketio';
	    form.style.position = 'absolute';
	    form.style.top = '-1000px';
	    form.style.left = '-1000px';
	    form.target = id;
	    form.method = 'POST';
	    form.setAttribute('accept-charset', 'utf-8');
	    area.name = 'd';
	    form.appendChild(area);
	    document.body.appendChild(form);
	
	    this.form = form;
	    this.area = area;
	  }
	
	  this.form.action = this.uri();
	
	  function complete () {
	    initIframe();
	    fn();
	  }
	
	  function initIframe () {
	    if (self.iframe) {
	      try {
	        self.form.removeChild(self.iframe);
	      } catch (e) {
	        self.onError('jsonp polling iframe removal error', e);
	      }
	    }
	
	    try {
	      // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
	      var html = '<iframe src="javascript:0" name="' + self.iframeId + '">';
	      iframe = document.createElement(html);
	    } catch (e) {
	      iframe = document.createElement('iframe');
	      iframe.name = self.iframeId;
	      iframe.src = 'javascript:0';
	    }
	
	    iframe.id = self.iframeId;
	
	    self.form.appendChild(iframe);
	    self.iframe = iframe;
	  }
	
	  initIframe();
	
	  // escape \n to prevent it from being converted into \r\n by some UAs
	  // double escaping is required for escaped new lines because unescaping of new lines can be done safely on server-side
	  data = data.replace(rEscapedNewline, '\\\n');
	  this.area.value = data.replace(rNewline, '\\n');
	
	  try {
	    this.form.submit();
	  } catch (e) {}
	
	  if (this.iframe.attachEvent) {
	    this.iframe.onreadystatechange = function () {
	      if (self.iframe.readyState === 'complete') {
	        complete();
	      }
	    };
	  } else {
	    this.iframe.onload = complete;
	  }
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 104 */
/***/ (function(module, exports, __webpack_require__) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * Module dependencies.
	 */
	
	var Transport = __webpack_require__(90);
	var parser = __webpack_require__(91);
	var parseqs = __webpack_require__(100);
	var inherit = __webpack_require__(101);
	var yeast = __webpack_require__(102);
	var debug = __webpack_require__(72)('engine.io-client:websocket');
	var BrowserWebSocket = global.WebSocket || global.MozWebSocket;
	var NodeWebSocket;
	if (typeof window === 'undefined') {
	  try {
	    NodeWebSocket = __webpack_require__(105);
	  } catch (e) { }
	}
	
	/**
	 * Get either the `WebSocket` or `MozWebSocket` globals
	 * in the browser or try to resolve WebSocket-compatible
	 * interface exposed by `ws` for Node-like environment.
	 */
	
	var WebSocket = BrowserWebSocket;
	if (!WebSocket && typeof window === 'undefined') {
	  WebSocket = NodeWebSocket;
	}
	
	/**
	 * Module exports.
	 */
	
	module.exports = WS;
	
	/**
	 * WebSocket transport constructor.
	 *
	 * @api {Object} connection options
	 * @api public
	 */
	
	function WS (opts) {
	  var forceBase64 = (opts && opts.forceBase64);
	  if (forceBase64) {
	    this.supportsBinary = false;
	  }
	  this.perMessageDeflate = opts.perMessageDeflate;
	  this.usingBrowserWebSocket = BrowserWebSocket && !opts.forceNode;
	  this.protocols = opts.protocols;
	  if (!this.usingBrowserWebSocket) {
	    WebSocket = NodeWebSocket;
	  }
	  Transport.call(this, opts);
	}
	
	/**
	 * Inherits from Transport.
	 */
	
	inherit(WS, Transport);
	
	/**
	 * Transport name.
	 *
	 * @api public
	 */
	
	WS.prototype.name = 'websocket';
	
	/*
	 * WebSockets support binary
	 */
	
	WS.prototype.supportsBinary = true;
	
	/**
	 * Opens socket.
	 *
	 * @api private
	 */
	
	WS.prototype.doOpen = function () {
	  if (!this.check()) {
	    // let probe timeout
	    return;
	  }
	
	  var uri = this.uri();
	  var protocols = this.protocols;
	  var opts = {
	    agent: this.agent,
	    perMessageDeflate: this.perMessageDeflate
	  };
	
	  // SSL options for Node.js client
	  opts.pfx = this.pfx;
	  opts.key = this.key;
	  opts.passphrase = this.passphrase;
	  opts.cert = this.cert;
	  opts.ca = this.ca;
	  opts.ciphers = this.ciphers;
	  opts.rejectUnauthorized = this.rejectUnauthorized;
	  if (this.extraHeaders) {
	    opts.headers = this.extraHeaders;
	  }
	  if (this.localAddress) {
	    opts.localAddress = this.localAddress;
	  }
	
	  try {
	    this.ws = this.usingBrowserWebSocket ? (protocols ? new WebSocket(uri, protocols) : new WebSocket(uri)) : new WebSocket(uri, protocols, opts);
	  } catch (err) {
	    return this.emit('error', err);
	  }
	
	  if (this.ws.binaryType === undefined) {
	    this.supportsBinary = false;
	  }
	
	  if (this.ws.supports && this.ws.supports.binary) {
	    this.supportsBinary = true;
	    this.ws.binaryType = 'nodebuffer';
	  } else {
	    this.ws.binaryType = 'arraybuffer';
	  }
	
	  this.addEventListeners();
	};
	
	/**
	 * Adds event listeners to the socket
	 *
	 * @api private
	 */
	
	WS.prototype.addEventListeners = function () {
	  var self = this;
	
	  this.ws.onopen = function () {
	    self.onOpen();
	  };
	  this.ws.onclose = function () {
	    self.onClose();
	  };
	  this.ws.onmessage = function (ev) {
	    self.onData(ev.data);
	  };
	  this.ws.onerror = function (e) {
	    self.onError('websocket error', e);
	  };
	};
	
	/**
	 * Writes data to socket.
	 *
	 * @param {Array} array of packets.
	 * @api private
	 */
	
	WS.prototype.write = function (packets) {
	  var self = this;
	  this.writable = false;
	
	  // encodePacket efficient as it uses WS framing
	  // no need for encodePayload
	  var total = packets.length;
	  for (var i = 0, l = total; i < l; i++) {
	    (function (packet) {
	      parser.encodePacket(packet, self.supportsBinary, function (data) {
	        if (!self.usingBrowserWebSocket) {
	          // always create a new object (GH-437)
	          var opts = {};
	          if (packet.options) {
	            opts.compress = packet.options.compress;
	          }
	
	          if (self.perMessageDeflate) {
	            var len = 'string' === typeof data ? global.Buffer.byteLength(data) : data.length;
	            if (len < self.perMessageDeflate.threshold) {
	              opts.compress = false;
	            }
	          }
	        }
	
	        // Sometimes the websocket has already been closed but the browser didn't
	        // have a chance of informing us about it yet, in that case send will
	        // throw an error
	        try {
	          if (self.usingBrowserWebSocket) {
	            // TypeError is thrown when passing the second argument on Safari
	            self.ws.send(data);
	          } else {
	            self.ws.send(data, opts);
	          }
	        } catch (e) {
	          debug('websocket closed before onclose event');
	        }
	
	        --total || done();
	      });
	    })(packets[i]);
	  }
	
	  function done () {
	    self.emit('flush');
	
	    // fake drain
	    // defer to next tick to allow Socket to clear writeBuffer
	    setTimeout(function () {
	      self.writable = true;
	      self.emit('drain');
	    }, 0);
	  }
	};
	
	/**
	 * Called upon close
	 *
	 * @api private
	 */
	
	WS.prototype.onClose = function () {
	  Transport.prototype.onClose.call(this);
	};
	
	/**
	 * Closes socket.
	 *
	 * @api private
	 */
	
	WS.prototype.doClose = function () {
	  if (typeof this.ws !== 'undefined') {
	    this.ws.close();
	  }
	};
	
	/**
	 * Generates uri for connection.
	 *
	 * @api private
	 */
	
	WS.prototype.uri = function () {
	  var query = this.query || {};
	  var schema = this.secure ? 'wss' : 'ws';
	  var port = '';
	
	  // avoid port if default for schema
	  if (this.port && (('wss' === schema && Number(this.port) !== 443) ||
	    ('ws' === schema && Number(this.port) !== 80))) {
	    port = ':' + this.port;
	  }
	
	  // append timestamp to URI
	  if (this.timestampRequests) {
	    query[this.timestampParam] = yeast();
	  }
	
	  // communicate binary support capabilities
	  if (!this.supportsBinary) {
	    query.b64 = 1;
	  }
	
	  query = parseqs.encode(query);
	
	  // prepend ? to query
	  if (query.length) {
	    query = '?' + query;
	  }
	
	  var ipv6 = this.hostname.indexOf(':') !== -1;
	  return schema + '://' + (ipv6 ? '[' + this.hostname + ']' : this.hostname) + port + this.path + query;
	};
	
	/**
	 * Feature detection for WebSocket.
	 *
	 * @return {Boolean} whether this transport is available.
	 * @api public
	 */
	
	WS.prototype.check = function () {
	  return !!WebSocket && !('__initialize' in WebSocket && this.name === WS.prototype.name);
	};
	
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 105 */
/***/ (function(module, exports) {

	/* (ignored) */

/***/ }),
/* 106 */
/***/ (function(module, exports) {

	
	var indexOf = [].indexOf;
	
	module.exports = function(arr, obj){
	  if (indexOf) return arr.indexOf(obj);
	  for (var i = 0; i < arr.length; ++i) {
	    if (arr[i] === obj) return i;
	  }
	  return -1;
	};

/***/ }),
/* 107 */
/***/ (function(module, exports) {

	/* WEBPACK VAR INJECTION */(function(global) {/**
	 * JSON parse.
	 *
	 * @see Based on jQuery#parseJSON (MIT) and JSON2
	 * @api private
	 */
	
	var rvalidchars = /^[\],:{}\s]*$/;
	var rvalidescape = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
	var rvalidtokens = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
	var rvalidbraces = /(?:^|:|,)(?:\s*\[)+/g;
	var rtrimLeft = /^\s+/;
	var rtrimRight = /\s+$/;
	
	module.exports = function parsejson(data) {
	  if ('string' != typeof data || !data) {
	    return null;
	  }
	
	  data = data.replace(rtrimLeft, '').replace(rtrimRight, '');
	
	  // Attempt to parse using the native JSON parser first
	  if (global.JSON && JSON.parse) {
	    return JSON.parse(data);
	  }
	
	  if (rvalidchars.test(data.replace(rvalidescape, '@')
	      .replace(rvalidtokens, ']')
	      .replace(rvalidbraces, ''))) {
	    return (new Function('return ' + data))();
	  }
	};
	/* WEBPACK VAR INJECTION */}.call(exports, (function() { return this; }())))

/***/ }),
/* 108 */
/***/ (function(module, exports, __webpack_require__) {

	
	/**
	 * Module dependencies.
	 */
	
	var parser = __webpack_require__(75);
	var Emitter = __webpack_require__(76);
	var toArray = __webpack_require__(109);
	var on = __webpack_require__(110);
	var bind = __webpack_require__(111);
	var debug = __webpack_require__(72)('socket.io-client:socket');
	var parseqs = __webpack_require__(100);
	
	/**
	 * Module exports.
	 */
	
	module.exports = exports = Socket;
	
	/**
	 * Internal events (blacklisted).
	 * These events can't be emitted by the user.
	 *
	 * @api private
	 */
	
	var events = {
	  connect: 1,
	  connect_error: 1,
	  connect_timeout: 1,
	  connecting: 1,
	  disconnect: 1,
	  error: 1,
	  reconnect: 1,
	  reconnect_attempt: 1,
	  reconnect_failed: 1,
	  reconnect_error: 1,
	  reconnecting: 1,
	  ping: 1,
	  pong: 1
	};
	
	/**
	 * Shortcut to `Emitter#emit`.
	 */
	
	var emit = Emitter.prototype.emit;
	
	/**
	 * `Socket` constructor.
	 *
	 * @api public
	 */
	
	function Socket (io, nsp, opts) {
	  this.io = io;
	  this.nsp = nsp;
	  this.json = this; // compat
	  this.ids = 0;
	  this.acks = {};
	  this.receiveBuffer = [];
	  this.sendBuffer = [];
	  this.connected = false;
	  this.disconnected = true;
	  if (opts && opts.query) {
	    this.query = opts.query;
	  }
	  if (this.io.autoConnect) this.open();
	}
	
	/**
	 * Mix in `Emitter`.
	 */
	
	Emitter(Socket.prototype);
	
	/**
	 * Subscribe to open, close and packet events
	 *
	 * @api private
	 */
	
	Socket.prototype.subEvents = function () {
	  if (this.subs) return;
	
	  var io = this.io;
	  this.subs = [
	    on(io, 'open', bind(this, 'onopen')),
	    on(io, 'packet', bind(this, 'onpacket')),
	    on(io, 'close', bind(this, 'onclose'))
	  ];
	};
	
	/**
	 * "Opens" the socket.
	 *
	 * @api public
	 */
	
	Socket.prototype.open =
	Socket.prototype.connect = function () {
	  if (this.connected) return this;
	
	  this.subEvents();
	  this.io.open(); // ensure open
	  if ('open' === this.io.readyState) this.onopen();
	  this.emit('connecting');
	  return this;
	};
	
	/**
	 * Sends a `message` event.
	 *
	 * @return {Socket} self
	 * @api public
	 */
	
	Socket.prototype.send = function () {
	  var args = toArray(arguments);
	  args.unshift('message');
	  this.emit.apply(this, args);
	  return this;
	};
	
	/**
	 * Override `emit`.
	 * If the event is in `events`, it's emitted normally.
	 *
	 * @param {String} event name
	 * @return {Socket} self
	 * @api public
	 */
	
	Socket.prototype.emit = function (ev) {
	  if (events.hasOwnProperty(ev)) {
	    emit.apply(this, arguments);
	    return this;
	  }
	
	  var args = toArray(arguments);
	  var packet = { type: parser.EVENT, data: args };
	
	  packet.options = {};
	  packet.options.compress = !this.flags || false !== this.flags.compress;
	
	  // event ack callback
	  if ('function' === typeof args[args.length - 1]) {
	    debug('emitting packet with ack id %d', this.ids);
	    this.acks[this.ids] = args.pop();
	    packet.id = this.ids++;
	  }
	
	  if (this.connected) {
	    this.packet(packet);
	  } else {
	    this.sendBuffer.push(packet);
	  }
	
	  delete this.flags;
	
	  return this;
	};
	
	/**
	 * Sends a packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */
	
	Socket.prototype.packet = function (packet) {
	  packet.nsp = this.nsp;
	  this.io.packet(packet);
	};
	
	/**
	 * Called upon engine `open`.
	 *
	 * @api private
	 */
	
	Socket.prototype.onopen = function () {
	  debug('transport is open - connecting');
	
	  // write connect packet if necessary
	  if ('/' !== this.nsp) {
	    if (this.query) {
	      var query = typeof this.query === 'object' ? parseqs.encode(this.query) : this.query;
	      debug('sending connect packet with query %s', query);
	      this.packet({type: parser.CONNECT, query: query});
	    } else {
	      this.packet({type: parser.CONNECT});
	    }
	  }
	};
	
	/**
	 * Called upon engine `close`.
	 *
	 * @param {String} reason
	 * @api private
	 */
	
	Socket.prototype.onclose = function (reason) {
	  debug('close (%s)', reason);
	  this.connected = false;
	  this.disconnected = true;
	  delete this.id;
	  this.emit('disconnect', reason);
	};
	
	/**
	 * Called with socket packet.
	 *
	 * @param {Object} packet
	 * @api private
	 */
	
	Socket.prototype.onpacket = function (packet) {
	  if (packet.nsp !== this.nsp) return;
	
	  switch (packet.type) {
	    case parser.CONNECT:
	      this.onconnect();
	      break;
	
	    case parser.EVENT:
	      this.onevent(packet);
	      break;
	
	    case parser.BINARY_EVENT:
	      this.onevent(packet);
	      break;
	
	    case parser.ACK:
	      this.onack(packet);
	      break;
	
	    case parser.BINARY_ACK:
	      this.onack(packet);
	      break;
	
	    case parser.DISCONNECT:
	      this.ondisconnect();
	      break;
	
	    case parser.ERROR:
	      this.emit('error', packet.data);
	      break;
	  }
	};
	
	/**
	 * Called upon a server event.
	 *
	 * @param {Object} packet
	 * @api private
	 */
	
	Socket.prototype.onevent = function (packet) {
	  var args = packet.data || [];
	  debug('emitting event %j', args);
	
	  if (null != packet.id) {
	    debug('attaching ack callback to event');
	    args.push(this.ack(packet.id));
	  }
	
	  if (this.connected) {
	    emit.apply(this, args);
	  } else {
	    this.receiveBuffer.push(args);
	  }
	};
	
	/**
	 * Produces an ack callback to emit with an event.
	 *
	 * @api private
	 */
	
	Socket.prototype.ack = function (id) {
	  var self = this;
	  var sent = false;
	  return function () {
	    // prevent double callbacks
	    if (sent) return;
	    sent = true;
	    var args = toArray(arguments);
	    debug('sending ack %j', args);
	
	    self.packet({
	      type: parser.ACK,
	      id: id,
	      data: args
	    });
	  };
	};
	
	/**
	 * Called upon a server acknowlegement.
	 *
	 * @param {Object} packet
	 * @api private
	 */
	
	Socket.prototype.onack = function (packet) {
	  var ack = this.acks[packet.id];
	  if ('function' === typeof ack) {
	    debug('calling ack %s with %j', packet.id, packet.data);
	    ack.apply(this, packet.data);
	    delete this.acks[packet.id];
	  } else {
	    debug('bad ack %s', packet.id);
	  }
	};
	
	/**
	 * Called upon server connect.
	 *
	 * @api private
	 */
	
	Socket.prototype.onconnect = function () {
	  this.connected = true;
	  this.disconnected = false;
	  this.emit('connect');
	  this.emitBuffered();
	};
	
	/**
	 * Emit buffered events (received and emitted).
	 *
	 * @api private
	 */
	
	Socket.prototype.emitBuffered = function () {
	  var i;
	  for (i = 0; i < this.receiveBuffer.length; i++) {
	    emit.apply(this, this.receiveBuffer[i]);
	  }
	  this.receiveBuffer = [];
	
	  for (i = 0; i < this.sendBuffer.length; i++) {
	    this.packet(this.sendBuffer[i]);
	  }
	  this.sendBuffer = [];
	};
	
	/**
	 * Called upon server disconnect.
	 *
	 * @api private
	 */
	
	Socket.prototype.ondisconnect = function () {
	  debug('server disconnect (%s)', this.nsp);
	  this.destroy();
	  this.onclose('io server disconnect');
	};
	
	/**
	 * Called upon forced client/server side disconnections,
	 * this method ensures the manager stops tracking us and
	 * that reconnections don't get triggered for this.
	 *
	 * @api private.
	 */
	
	Socket.prototype.destroy = function () {
	  if (this.subs) {
	    // clean subscriptions to avoid reconnections
	    for (var i = 0; i < this.subs.length; i++) {
	      this.subs[i].destroy();
	    }
	    this.subs = null;
	  }
	
	  this.io.destroy(this);
	};
	
	/**
	 * Disconnects the socket manually.
	 *
	 * @return {Socket} self
	 * @api public
	 */
	
	Socket.prototype.close =
	Socket.prototype.disconnect = function () {
	  if (this.connected) {
	    debug('performing disconnect (%s)', this.nsp);
	    this.packet({ type: parser.DISCONNECT });
	  }
	
	  // remove socket from pool
	  this.destroy();
	
	  if (this.connected) {
	    // fire events
	    this.onclose('io client disconnect');
	  }
	  return this;
	};
	
	/**
	 * Sets the compress flag.
	 *
	 * @param {Boolean} if `true`, compresses the sending data
	 * @return {Socket} self
	 * @api public
	 */
	
	Socket.prototype.compress = function (compress) {
	  this.flags = this.flags || {};
	  this.flags.compress = compress;
	  return this;
	};


/***/ }),
/* 109 */
/***/ (function(module, exports) {

	module.exports = toArray
	
	function toArray(list, index) {
	    var array = []
	
	    index = index || 0
	
	    for (var i = index || 0; i < list.length; i++) {
	        array[i - index] = list[i]
	    }
	
	    return array
	}


/***/ }),
/* 110 */
/***/ (function(module, exports) {

	
	/**
	 * Module exports.
	 */
	
	module.exports = on;
	
	/**
	 * Helper for subscriptions.
	 *
	 * @param {Object|EventEmitter} obj with `Emitter` mixin or `EventEmitter`
	 * @param {String} event name
	 * @param {Function} callback
	 * @api public
	 */
	
	function on (obj, ev, fn) {
	  obj.on(ev, fn);
	  return {
	    destroy: function () {
	      obj.removeListener(ev, fn);
	    }
	  };
	}


/***/ }),
/* 111 */
/***/ (function(module, exports) {

	/**
	 * Slice reference.
	 */
	
	var slice = [].slice;
	
	/**
	 * Bind `obj` to `fn`.
	 *
	 * @param {Object} obj
	 * @param {Function|String} fn or string
	 * @return {Function}
	 * @api public
	 */
	
	module.exports = function(obj, fn){
	  if ('string' == typeof fn) fn = obj[fn];
	  if ('function' != typeof fn) throw new Error('bind() requires a function');
	  var args = slice.call(arguments, 2);
	  return function(){
	    return fn.apply(obj, args.concat(slice.call(arguments)));
	  }
	};


/***/ }),
/* 112 */
/***/ (function(module, exports) {

	
	/**
	 * Expose `Backoff`.
	 */
	
	module.exports = Backoff;
	
	/**
	 * Initialize backoff timer with `opts`.
	 *
	 * - `min` initial timeout in milliseconds [100]
	 * - `max` max timeout [10000]
	 * - `jitter` [0]
	 * - `factor` [2]
	 *
	 * @param {Object} opts
	 * @api public
	 */
	
	function Backoff(opts) {
	  opts = opts || {};
	  this.ms = opts.min || 100;
	  this.max = opts.max || 10000;
	  this.factor = opts.factor || 2;
	  this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
	  this.attempts = 0;
	}
	
	/**
	 * Return the backoff duration.
	 *
	 * @return {Number}
	 * @api public
	 */
	
	Backoff.prototype.duration = function(){
	  var ms = this.ms * Math.pow(this.factor, this.attempts++);
	  if (this.jitter) {
	    var rand =  Math.random();
	    var deviation = Math.floor(rand * this.jitter * ms);
	    ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
	  }
	  return Math.min(ms, this.max) | 0;
	};
	
	/**
	 * Reset the number of attempts.
	 *
	 * @api public
	 */
	
	Backoff.prototype.reset = function(){
	  this.attempts = 0;
	};
	
	/**
	 * Set the minimum duration
	 *
	 * @api public
	 */
	
	Backoff.prototype.setMin = function(min){
	  this.ms = min;
	};
	
	/**
	 * Set the maximum duration
	 *
	 * @api public
	 */
	
	Backoff.prototype.setMax = function(max){
	  this.max = max;
	};
	
	/**
	 * Set the jitter
	 *
	 * @api public
	 */
	
	Backoff.prototype.setJitter = function(jitter){
	  this.jitter = jitter;
	};
	


/***/ }),
/* 113 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	var object = __webpack_require__(3);
	
	/**
	 * Dumb implementation (id monkey patch) of a map were
	 * keys are weakely tied
	 */
	function naiveWeakMap() {
	  var self = object.create(naiveWeakMap.prototype);
	
	  self.storage = {};
	  self.nextId = 0;
	
	  return self;
	}
	
	naiveWeakMap.prototype.set = function set(key, value) {
	  key.___weakId = this.nextId; // eslint-disable-line no-underscore-dangle,no-param-reassign
	  this.nextId += 1;
	
	  this.storage[key.___weakId] = value; // eslint-disable-line no-underscore-dangle
	};
	
	naiveWeakMap.prototype.get = function get(key) {
	  return this.storage[key.___weakId]; // eslint-disable-line no-underscore-dangle
	};
	
	naiveWeakMap.prototype.del = function del(key) {
	  delete this.storage[key.___weakId]; // eslint-disable-line no-underscore-dangle
	};
	
	module.exports = naiveWeakMap;


/***/ }),
/* 114 */
/***/ (function(module, exports, __webpack_require__) {

	'use strict';
	
	// Null client used when no event client listener is needed (transport=manual)
	
	var EventEmitter = __webpack_require__(28).EventEmitter;
	var object = __webpack_require__(3);
	var asyncHelpers = __webpack_require__(4);
	
	function nullClient() {
	  var self = object.create(nullClient.prototype);
	
	  EventEmitter.call(self);
	
	  return self;
	}
	
	nullClient.prototype = new EventEmitter();
	
	nullClient.prototype.connect = function connect(token, callback) {
	  asyncHelpers.setImmediate(callback);
	};
	
	module.exports = nullClient;


/***/ })
/******/ ])
});
;
//# sourceMappingURL=guardian-js.js.map