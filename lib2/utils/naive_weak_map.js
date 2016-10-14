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
  key.___weakId = self.nextId;
  self.nextId += 1;

  self.storage[key.___weakId] = value;
};

naiveWeakMap.prototype.get = function get(key) {
  return self.storage[key.___weakId];
};

naiveWeakMap.prototype.del = function del(key) {
  delete self.storage[key.___weakId];
};

module.exports = naiveWeakMap;
