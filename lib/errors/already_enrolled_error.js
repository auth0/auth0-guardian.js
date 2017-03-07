'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function AlreadyEnrolledError() {
  GuardianError.call(this, {
    message: 'You cannot enroll again. You are already enrolled.',
    errorCode: 'already_enrolled'
  });
}

AlreadyEnrolledError.prototype = object.create(GuardianError.prototype);
AlreadyEnrolledError.prototype.constructor = AlreadyEnrolledError;

module.exports = AlreadyEnrolledError;
