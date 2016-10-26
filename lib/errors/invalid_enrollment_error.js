'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function InvalidEnrollmentError() {
  GuardianError.call(this, {
    message: 'The enrollment provided is not valid, null or undefined',
    errorCode: 'invalid_enrollment'
  });
}

InvalidEnrollmentError.prototype = object.create(GuardianError.prototype);
InvalidEnrollmentError.prototype.contructor = InvalidEnrollmentError;

module.exports = InvalidEnrollmentError;
