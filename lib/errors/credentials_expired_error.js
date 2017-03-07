'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function CredentialsExpiredError() {
  GuardianError.call(this, {
    message: 'The credentials has expired.',
    errorCode: 'credentials_expired'
  });
}

CredentialsExpiredError.prototype = object.create(GuardianError.prototype);
CredentialsExpiredError.prototype.constructor = CredentialsExpiredError;

module.exports = CredentialsExpiredError;
