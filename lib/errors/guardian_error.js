'use strict';

module.exports = class GuardianError extends Error {
  constructor(payload) {
    super(payload.message);

    this.errorCode = payload.errorCode;
    this.statusCode = payload.statusCode;
    this.stack = (payload.cause && payload.cause.stack) || this.stack;
  }
};
