'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function RequestTokenExpiredError() {
  GuardianError.call(this, {
    message: 'The transaction has expired.',
    errorCode: 'transaction_expired'
  });
}

RequestTokenExpiredError.prototype = object.create(GuardianError.prototype);
RequestTokenExpiredError.prototype.contructor = RequestTokenExpiredError;

module.exports = RequestTokenExpiredError;
