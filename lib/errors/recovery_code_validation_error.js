'use strict';

const GuardianError = require('./guardian_error');

module.exports = class RecoveryCodeValidationError extends GuardianError {
  constructor() {
    super({
      message: 'Recovery code validation error',
      errorCode: 'invalid_recovery_code'
    });
  }
}
