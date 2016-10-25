'use strict';

var object = require('../utils/object');
var async = require('../utils/async');
var EventEmitter = require('events').EventEmitter;
var helpers = require('./helpers');

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

authVerificationStep.prototype.verify = function verify(data) {
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
    async.any([listenLoginCompleteTask, listenLoginRejectedTask], done);
  };

  var verifyAuthTask = function verifyAuthTask(done) {
    self.strategy.verify(data, function onVerified(err, verificationPayload) {
      // eslint-disable-next-line no-param-reassign
      verificationPayload = verificationPayload || {};

      if (err) {
        done(err);
        return;
      }

      done(null, {
        // New recovery code if needed (recover)
        recoveryCode: verificationPayload.recoveryCode
      });
    });
  };

  // This function takes care of the possible difference on arrival because
  // of the difference on transportation layer, it is perfectly possible
  // for completion event to arrive BEFORE the http call response
  async.all([
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

module.exports = authVerificationStep;
