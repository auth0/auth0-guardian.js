'use strict';

const GuardianError = require('./guardian_error');

function FieldRequiredError(field) {
  GuardianError.call(this, {
    message: field + ' is required',
    errorCode: 'field_required_error'
  });
}

FieldRequiredError.prototype = object.create(GuardianError.prototype);
FieldRequiredError.prototype.contructor = FieldRequiredError;

module.exports = FieldRequiredError;
