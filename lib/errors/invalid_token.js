'use strict';

var object = require('../utils/object');
var GuardianError = require('./guardian_error');

function InvalidToken(message) {
  GuardianError.call(this, {
    message: message,
    errorCode: 'invalid_token'
  });
}

InvalidToken.prototype = object.create(GuardianError.prototype);
InvalidToken.prototype.constructor = InvalidToken;

module.exports = InvalidToken;
