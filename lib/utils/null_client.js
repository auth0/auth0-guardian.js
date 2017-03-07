'use strict';

// Null client used when no event client listener is needed (transport=manual)

var EventEmitter = require('events').EventEmitter;
var object = require('./object');
var asyncHelpers = require('./async');

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
