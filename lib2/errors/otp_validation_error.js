'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function OtpValidationError() {
  GuardianError.call(this, {
    message: 'OTP validation error',
    errorCode: 'invalid_otp'
  });
}

OtpValidationError.prototype = object.create(GuardianError.prototype);
OtpValidationError.prototype.contructor = OtpValidationError;

module.exports = OtpValidationError;
