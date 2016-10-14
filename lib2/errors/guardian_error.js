'use strict';

var object = require('../utils/object');

function GuardianError (payload) {
  Error.call(this, payload.message);

  this.errorCode = payload.errorCode;
  this.statusCode = payload.statusCode;
  this.stack = (payload.cause && payload.cause.stack) || this.stack;
};

GuardianError.prototype = object.create(Error.payload);
GuardianError.prototype.constructor = GuardianError;

module.exports = GuardianError;
