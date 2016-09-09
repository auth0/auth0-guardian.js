'use strict';

const object = require('./object');

const OTP_LENGTH = 6;
const RECOVERY_CODE_LENGTH = 24;

exports.validateOtp = function(otp) {
  otp = otp && otp.toString();

  return object.isIntegerString(otp) && otp.length === OTP_LENGTH;
};

exports.validateRecoveryCode = function validateRecovery(recovery) {
  recovery = recovery && recovery.toString();

  return recovery && object.isAlphaNumeric(recovery) && recovery.length === RECOVERY_CODE_LENGTH;
};
