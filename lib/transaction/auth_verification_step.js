'use strict';

var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var EventEmitter = require('events').EventEmitter;
var helpers = require('./helpers');
var events = require('../utils/events');

function authVerificationStep(strategy, options) {
  var self = object.create(authVerificationStep.prototype);
  EventEmitter.call(self);

  self.strategy = strategy;
  self.transaction = options.transaction;
  self.loginCompleteHub = options.loginCompleteHub;
  self.loginRejectedHub = options.loginRejectedHub;

  return self;
}

authVerificationStep.prototype = object.create(EventEmitter.prototype);

/**
 * Returns method associated with current auth flow
 *
 * @returns {sms|otp|push}
 */
authVerificationStep.prototype.getMethod = function getMethod() {
  return this.strategy.method;
};

/**
 * @param {object} data
 * @param {function} [acceptedCallback] Triggered once the data has been
 * accepted by the service provider, the first arguments indicates if it
 * was valid
 */
authVerificationStep.prototype.verify = function verify(data, acceptedCallback) {
  // eslint-disable-next-line no-param-reassign
  acceptedCallback = acceptedCallback || function noop() {};

  var self = this;

  // TODO Move this to the transaction
  self.loginCompleteHub.removeAllListeners();
  self.loginRejectedHub.removeAllListeners();

  var listenLoginCompleteTask = function listenLoginCompleteTask(done) {
    self.loginCompleteHub.listenOnce(function onLoginComplete(completionPayload) {
      done(null, helpers.buildAuthCompletionPayload(true, completionPayload.signature));
    });
  };

  var listenLoginRejectedTask = function listenLoginRejectedTask(done) {
    self.loginRejectedHub.listenOnce(function onLoginRejected() {
      done(null, helpers.buildAuthCompletionPayload(false, null));
    });
  };

  var loginOrRejectTask = function loginOrRejectTask(done) {
    asyncHelpers.any([listenLoginCompleteTask, listenLoginRejectedTask], done);
  };

  var verifyAuthTask = function verifyAuthTask(done) {
    self.strategy.verify(data, function onVerified(err, verificationPayload) {
      // eslint-disable-next-line no-param-reassign
      verificationPayload = verificationPayload || {};

      if (err) {
        if (acceptedCallback) {
          events.ignoreError(self, err);

          acceptedCallback(err);
        }

        done(err);
        return;
      }

      var payload = {
        // New recovery code if needed (recover)
        recoveryCode: verificationPayload.recoveryCode
      };

      // On the one hand we trigger the callback since the data has been
      // accepted by the service provider, on the other hand
      // we still need to wait for (loginOrRejectTask) to trigger the event.
      // loginOrRejectTask might never be triggered in case of transport=manual
      acceptedCallback(null, payload);
      done(null, payload);
    });
  };

  // This function takes care of the possible difference on arrival because
  // of the difference on transportation layer, it is perfectly possible
  // for completion event to arrive BEFORE the http call response
  asyncHelpers.all([
    loginOrRejectTask,
    verifyAuthTask
  ], function onCompletion(err, payloads) {
    // TODO Move this to the transaction
    self.loginCompleteHub.removeAllListeners();
    self.loginRejectedHub.removeAllListeners();

    if (err) {
      self.emit('error', err);
      return;
    }

    self.emit('auth-response', object.assign.apply(object, payloads));
  });
};

authVerificationStep.prototype.serialize = function serialize() {
  var self = this;

  return { method: self.getMethod() };
};

module.exports = authVerificationStep;
