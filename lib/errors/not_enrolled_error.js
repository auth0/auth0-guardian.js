'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function NotEnrolledError() {
  GuardianError.call(this, {
    message: 'You are not enrolled. Please enroll before trying to authenticate',
    errorCode: 'not_enrolled'
  });
}

NotEnrolledError.prototype = object.create(GuardianError.prototype);
NotEnrolledError.prototype.contructor = NotEnrolledError;

module.exports = NotEnrolledError;
