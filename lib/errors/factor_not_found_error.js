'use strict';

const GuardianError = require('./guardian_error');

module.exports = class FactorNotAllowedError extends GuardianError {
  constructor() {
    super({
      message: 'Not a valid factor name.',
      errorCode: 'factor_not_found'
    });
  }
};
