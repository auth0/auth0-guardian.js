'use strict';

const GuardianError = require('./guardian_error');

/**
 * When you cannot authenticate with a device because it is not enrolled yet
 */
module.exports = class NotValidStateError extends GuardianError {
  constructor(message) {
    super({
      message: message,
      errorCode: 'not_valid_state'
    });
  }
}
