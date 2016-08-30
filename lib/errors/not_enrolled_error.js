'use strict';

const GuardianError = require('./guardian_error');

/**
 * When you cannot authenticate with a device because it is not enrolled yet
 */
module.exports = class NotEnrolledError extends GuardianError {
  constructor() {
    super({
      message: 'You cannot authenticate using this device. It is not enrolled.',
      errorCode: 'not_enrolled_error'
    });
  }
}
