'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function InvalidStateError(message) {
  GuardianError.call(this, {
    message: message,
    errorCode: 'invalid_state'
  });
}

InvalidStateError.prototype = object.create(GuardianError.prototype);
InvalidStateError.prototype.contructor = InvalidStateError;

module.exports = InvalidStateError;
