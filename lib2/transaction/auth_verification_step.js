'use strict';

var object = require('./utils/object');
var async = require('./utils/async');
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

authVerificationStep.prototype.verify = function verify(data, callback) {
  var self = this;

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
      if (err) {
        return callback(err);
      }

      return done(null, {
        // New recovery code if needed (recover)
        recoverCode: verificationPayload.recoverCode
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
    self.loginCompleteHub.removeAllListeners();
    self.loginRejectedHub.removeAllListeners();

    if (err) {
      return self.emit('error', err);
    }

    return self.emit('auth-response', object.assign.apply(object, payloads));
  });
};
