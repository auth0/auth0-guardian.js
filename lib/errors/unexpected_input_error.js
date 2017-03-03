'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function UnexpectedInputError(message) {
  GuardianError.call(this, {
    message: message,
    errorCode: 'unexpected_input'
  });
}

UnexpectedInputError.prototype = object.create(GuardianError.prototype);
UnexpectedInputError.prototype.contructor = UnexpectedInputError;

module.exports = UnexpectedInputError;
