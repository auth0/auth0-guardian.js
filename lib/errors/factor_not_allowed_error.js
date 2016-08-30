'use strict';

const GuardianError = require('./guardian_error');

module.exports = class FactorNotAllowedError extends GuardianError {
  constructor() {
    super({
      message: 'This factor is not allowed on current setup.',
      errorCode: 'factor_not_allowed'
    });
  }
}
