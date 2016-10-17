'use strict';

var object = require('./object');

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
