'use strict';

/**
 * Returns true if the enrollment is confirmed
 */
exports.isEnrollmentConfirmed = function isEnrollmentConfirmed(enrollment) {
  return enrollment.status === 'confirmed';
};

