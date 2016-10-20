'use strict';

/**
 * Builds authentication completion payload
 *
 * @param {boolean} accepted if the auth was accepted
 * @param {string} signature auth token to send to the server to verify the authentication
 */
exports.buildAuthCompletionPayload = function buildAuthCompletionPayload(accepted, signature) {
  return {
    accepted: accepted,
    signature: signature
  };
};

/**
 * @param {object} options.apiPayload
 * @param {string} options.method
 * @param {EnrollmentAttempt} options.enrollmentAttempt
 * @param {Enrollment} options.enrollment new enrollment
 */
exports.buildEnrollmentCompletePayload = function buildEnrollmentCompletePayload(options) {
  var apiPayload = options.apiPayload;
  var method = options.method;
  var enrollmentAttempt = options.enrollmentAttempt;
  var txId = options.txId;

  var payload = {
    enrollment: options.enrollment
  };

  if (enrollmentAttempt && apiPayload.txId === txId) {
    // Belongs to this transaction
    payload.recoveryCode = enrollmentAttempt.getRecoveryCode();
    payload.authRequired = enrollmentAttempt.isAuthRequired(method);
  } else {
    payload.recoveryCode = null;

    // Enrollment was not made from this transaction which means
    // you will have to login to continue
    payload.authRequired = true;
  }

  return payload;
};
