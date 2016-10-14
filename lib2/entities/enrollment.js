'use strict';

var object = require('../utils/object');

/**
 * Represents a complete enrollment with its associated data
 *
 * @param {string} [data.name] Enrollment name
 * @param {string} [data.phoneNumber] Enrollment phone number (masked)
 * @param {array.<sms|push|otp>} data.availableMethods
 *
 * @public
 * @returns {Enrollment}
 */
function enrollment(data) {
  var self = object.create(enrollment.prototype);

  self.data = data;

  return self;
}

/**
 * @returns {array.<string>} available methods: push|sms|otp
 */
enrollment.prototype.getAvailableMethods = function() {
  return this.data.availableMethods;
};

/**
 * @returns {string} returns name or undefined if not present
 */
enrollment.prototype.getName = function() {
  return this.data.name;
};

/**
 * @returns {string} returns masked phone number
 */
enrollment.prototype.getPhoneNumber = function() {
  return this.data.phoneNumber;
};

module.exports = enrollment;
