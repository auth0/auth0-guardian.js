'use strict';

/**
 * Common validations
 */

const object = require('./object');

const OTP_LENGTH = 6;
const RECOVERY_CODE_LENGTH = 24;

/**
 * @param {string} iotp One time password
 *
 * @returns {boolean} true if otp is a valid otp, false otherwise
 */
exports.validateOtp = function validateOtp(iotp) {
  const otp = iotp && iotp.toString();

  return object.isIntegerString(otp) && otp.length === OTP_LENGTH;
};

/**
 * @param {string} irecovery Recovery code
 *
 * @returns {boolean} true if recovery is a valid recovery code (regarding format),
 * false otherwise
 */
exports.validateRecoveryCode = function validateRecovery(irecovery) {
  const recovery = irecovery && irecovery.toString();

  return recovery && object.isAlphaNumeric(recovery) && recovery.length === RECOVERY_CODE_LENGTH;
};
