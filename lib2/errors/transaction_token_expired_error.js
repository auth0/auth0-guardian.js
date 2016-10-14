'use strict';

const GuardianError = require('./guardian_error');

function RequestTokenExpiredError() {
  GuardianError.call(this, {
    message: 'The transaction token has expired.',
    errorCode: 'transaction_token_expired'
  });
}

RequestTokenExpiredError.prototype = object.create(GuardianError.prototype);
RequestTokenExpiredError.prototype.contructor = RequestTokenExpiredError;

module.exports = RequestTokenExpiredError;
