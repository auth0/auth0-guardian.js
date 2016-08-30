'use strict';

const GuardianError = require('./guardian_error');

module.exports = class OperationNotAllowedError extends GuardianError {
  constructor() {
    super({
      message: 'This operation is not allowed on current stage',
      errorCode: 'operation_not_allowed'
    });
  }
}
