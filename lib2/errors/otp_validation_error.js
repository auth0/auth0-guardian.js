'use strict';

const GuardianError = require('./guardian_error');

function OtpValidationError() {
  GuardianError.call(this, {
    message: 'OTP validation error',
    errorCode: 'invalid_otp'
  });
}

OtpValidationError.prototype = object.create(GuardianError.prototype);
OtpValidationError.prototype.contructor = FieldRequiredError;

module.exports = OtpValidationError;
