'use strict';

const GuardianError = require('./guardian_error');

module.exports = class RequestTokenExpiredError extends GuardianError {
  constructor() {
    super({
      message: 'The transaction token has expired.',
      errorCode: 'transaction_token_expired'
    });
  }
};
