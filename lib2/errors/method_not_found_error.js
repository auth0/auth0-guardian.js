'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function MethodNotFoundError(method) {
  GuardianError.call(this, {
    message: 'Method ' + method + 'was not found',
    errorCode: 'method_not_found'
  });
}

MethodNotFoundError.prototype = object.create(GuardianError.prototype);
MethodNotFoundError.prototype.contructor = MethodNotFoundError;

module.exports = MethodNotFoundError;
