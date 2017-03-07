'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function EnrollmentMethodDisabledError(method) {
  GuardianError.call(this, {
    message: 'The method ' + method + 'is disabled',
    errorCode: 'enrollment_method_disabled'
  });

  this.method = method;
}

EnrollmentMethodDisabledError.prototype = object.create(GuardianError.prototype);
EnrollmentMethodDisabledError.prototype.constructor = EnrollmentMethodDisabledError;

module.exports = EnrollmentMethodDisabledError;
