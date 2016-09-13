'use strict';

/**
 * Common validations
 */

const object = require('./object');

const OTP_LENGTH = 6;
const RECOVERY_CODE_LENGTH = 24;

/**
 * @param {string} otp One time password
 *
 * @returns {boolean} true if otp is a valid otp, false otherwise
 */
exports.validateOtp = function validateOtp(otp) {
  otp = otp && otp.toString();

  return object.isIntegerString(otp) && otp.length === OTP_LENGTH;
};

/**
 * @param {string} recovery Recovery code
 *
 * @returns {boolean} true if recovery is a valid recovery code (regarding format),
 * false otherwise
 */
exports.validateRecoveryCode = function validateRecovery(recovery) {
  recovery = recovery && recovery.toString();

  return recovery && object.isAlphaNumeric(recovery) && recovery.length === RECOVERY_CODE_LENGTH;
};
