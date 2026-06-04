'use strict';

/**
 * Common validations
 */

var object = require('./object');

var OTP_LENGTH = 6;
var RECOVERY_CODE_LENGTH = 24;

exports.DEFAULT_OTP_LENGTH = OTP_LENGTH;

/**
 * @param {string} iotp One time password
 * @param {number} [otpLength] Expected number of digits. Defaults to 6 to
 *  preserve the historical behaviour for callers that don't supply a length.
 *
 * @returns {boolean} true if otp is a valid otp, false otherwise
 */
exports.validateOtp = function validateOtp(iotp, otpLength) {
  var otp = iotp && iotp.toString();
  var expectedLength = typeof otpLength === 'number' ? otpLength : OTP_LENGTH;

  return object.isIntegerString(otp) && otp.length === expectedLength;
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
