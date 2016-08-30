'use strict';

const GuardianError = require('./guardian_error');

/**
 * When you cannot authenticate with a device because it is not enrolled yet
 */
module.exports = class FieldRequiredError extends GuardianError {
  constructor(field) {
    super({
      message: `${field} is required`,
      errorCode: 'field_required_error'
    });
  }
}
