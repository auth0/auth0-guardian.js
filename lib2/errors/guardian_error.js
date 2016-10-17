'use strict';

var object = require('../utils/object');

var codeMap = {
   // TODO Remove once the new widget is up and running
  device_account_conflict: 'enrollment_conflict',
  device_account_not_found: 'enrollment_not_found'
};

function GuardianError(payload) {
  Error.call(this, payload.message);

  if (codeMap[payload.errorCode]) {
    this.errorCode = codeMap[payload.errorCode];
  } else {
    this.errorCode = payload.errorCode;
  }

  this.statusCode = payload.statusCode;
  this.stack = (payload.cause && payload.cause.stack) || this.stack;
}

GuardianError.prototype = object.create(Error.prototype);
GuardianError.prototype.constructor = GuardianError;

module.exports = GuardianError;
