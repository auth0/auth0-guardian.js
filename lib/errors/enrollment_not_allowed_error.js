'use strict';

const GuardianError = require('./guardian_error');

/**
 * When you cannot enroll a new device
 */
module.exports = class EnrollmentNotAllowedError extends GuardianError {
  constructor() {
    super({
      message: 'You cannot enroll a new device. Are you already enrolled?',
      errorCode: 'enrollment_not_allowed_error'
    });
  }
}
