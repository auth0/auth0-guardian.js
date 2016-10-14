'use strict';

/**
 * Common validations
 */

var object = require('./object');

var OTP_LENGTH = 6;
var RECOVERY_CODE_LENGTH = 24;

/**
 * @param {string} iotp One time password
 *
 * @returns {boolean} true if otp is a valid otp, false otherwise
 */
exports.validateOtp = function validateOtp(iotp) {
  var otp = iotp && iotp.toString();

  return object.isIntegerString(otp) && otp.length === OTP_LENGTH;
};

/**
 * @param {string} irecovery Recovery code
 *
 * @returns {boolean} true if recovery is a valid recovery code (regarding format),
 * false otherwise
 */
exports.validateRecoveryCode = function validateRecovery(irecovery) {
  var recovery = irecovery && irecovery.toString();

  return recovery && object.isAlphaNumeric(recovery) && recovery.length === RECOVERY_CODE_LENGTH;
};
