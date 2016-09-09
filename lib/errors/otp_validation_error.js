'use strict';

const GuardianError = require('./guardian_error');

module.exports = class OTPValidationError extends GuardianError {
  constructor() {
    super({
      message: 'OTP validation error',
      errorCode: 'invalid_otp'
    });
  }
}
