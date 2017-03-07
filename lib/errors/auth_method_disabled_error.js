'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function AuthMethodDisabledError(method) {
  GuardianError.call(this, {
    message: 'The method ' + method + 'is disabled',
    errorCode: 'auth_method_disabled'
  });

  this.method = method;
}

AuthMethodDisabledError.prototype = object.create(GuardianError.prototype);
AuthMethodDisabledError.prototype.constructor = AuthMethodDisabledError;

module.exports = AuthMethodDisabledError;
