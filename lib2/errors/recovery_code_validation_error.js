'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function RecoveryCodeValidationError() {
  GuardianError.call(this, {
    message: 'Recovery code validation error',
    errorCode: 'invalid_recovery_code'
  });
}

RecoveryCodeValidationError.prototype = object.create(GuardianError.prototype);
RecoveryCodeValidationError.prototype.contructor = RecoveryCodeValidationError;

module.exports = RecoveryCodeValidationError;
