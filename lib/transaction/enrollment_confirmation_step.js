var object = require('../utils/object');
var asyncHelpers = require('../utils/async');
var events = require('../utils/events');
var EventEmitter = require('events').EventEmitter;
var enrollmentBuilder = require('../entities/enrollment');
var helpers = require('./helpers');

/**
 * @param {EnrollmentStrategy} options.strategy
 * @param {EnrollmentAttempt} options.enrollmentAttempt
 * @param {EventEmitter} options.enrollmentCompleteHub
 */
function enrollmentConfirmationStep(options) {
  var self = object.create(enrollmentConfirmationStep.prototype);
  EventEmitter.call(self);

  self.strategy = options.strategy;
  self.transaction = options.transaction;
  self.enrollmentAttempt = options.enrollmentAttempt;
  self.enrollmentCompleteHub = options.enrollmentCompleteHub;

  return self;
}

enrollmentConfirmationStep.prototype = object.create(EventEmitter.prototype);

enrollmentConfirmationStep.prototype.getUri = function getUri() {
  return this.strategy.getUri();
};

enrollmentConfirmationStep.prototype.getData = function getData() {
  return this.strategy.getData();
};

enrollmentConfirmationStep.prototype.getMethod = function getMethod() {
  return this.strategy.method;
};

/**
 * @param {object} data
 * @param {function} [acceptedCallback] Triggered once the data has been accepted by
 * the service provider, the first argument indicates if it was valid
 */
enrollmentConfirmationStep.prototype.confirm = function confirm(data, acceptedCallback) {
  var self = this;

  // TODO Move this to the transaction
  self.enrollmentCompleteHub.removeAllListeners();

  var listenToEnrollmentCompleteTask = function listenToEnrollmentCompleteTask(done) {
    self.enrollmentCompleteHub.listenOnce(function onEnrollmentComplete(payload) {
      done(null, payload);
    });
  };

  var confirmTask = function confirmTask(done) {
    self.strategy.confirm(data, function confirmationDataAccepted(err, result) {
      if (err) {
        if (acceptedCallback) {
          events.ignoreError(self, err);

          acceptedCallback(err);
        }

        done(err);
        return;
      }

      if (acceptedCallback) {
        acceptedCallback(err, { recoveryCode: self.enrollmentAttempt.getRecoveryCode() });
      }

      done(err, result);
    });
  };

  asyncHelpers.all([
    listenToEnrollmentCompleteTask,
    confirmTask
  ], function onAllComplete(err, results) {
    // TODO Move this to the transaction
    self.enrollmentCompleteHub.removeAllListeners();

    if (err) {
      self.emit('error', err);
      return;
    }

    var apiPayload = results[0];

    var payload = helpers.buildEnrollmentCompletePayload({
      txId: self.transaction.txId,
      apiPayload: apiPayload,
      method: self.strategy.method,
      enrollmentAttempt: self.enrollmentAttempt,
      enrollment: enrollmentBuilder(apiPayload.deviceAccount)
    });

    self.emit('enrollment-complete', payload);
  });
};

enrollmentConfirmationStep.prototype.serialize = function serialize() {
  var self = this;

  return { method: self.getMethod() };
};

module.exports = enrollmentConfirmationStep;
