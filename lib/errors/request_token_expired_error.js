'use strict';

const GuardianError = require('./guardian_error');

module.exports = class RequestTokenExpiredError extends GuardianError {
  constructor() {
    super({
      message: 'The request token has expired.',
      errorCode: 'request_token_expired'
    });
  }
}
