'use strict';

const GuardianError = require('./guardian_error');

function MethodNotFoundError(method) {
  GuardianError.call(this, {
    message: 'Method ' + method + 'was not found',
    errorCode: 'method_not_found'
  });
}

NoMethodAvailableError.prototype = object.create(GuardianError.prototype);
NoMethodAvailableError.prototype.contructor = RequestTokenExpiredError;

module.exports = NoMethodAvailableError;
