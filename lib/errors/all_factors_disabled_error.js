'use strict';

const GuardianError = require('./guardian_error');

module.exports = class AllFactorsDisabledError extends GuardianError {
  constructor() {
    super({
      message: 'There are not factors to enroll with',
      errorCode: 'all_factors_disabled'
    });
  }
}
