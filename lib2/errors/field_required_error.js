'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function FieldRequiredError(field) {
  GuardianError.call(this, {
    message: field + ' is required',
    errorCode: 'field_required'
  });
  this.field = field;
}

FieldRequiredError.prototype = object.create(GuardianError.prototype);
FieldRequiredError.prototype.contructor = FieldRequiredError;

module.exports = FieldRequiredError;
