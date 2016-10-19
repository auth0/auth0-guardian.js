var object = require('./utils/object');
var async = require('./utils/async');
var EventEmitter = require('events').EventEmitter;
var enrollmentBuilder = require('./entities/enrollment');
var helpers = require('./helpers');

/**
 * @param {EnrollmentStrategy} options.strategy
 * @param {EnrollmentAttempt} options.enrollmentAttempt
 * @param {EventEmitter} options.enrollmentCompleteHub
 * @param {Transaction} options.transaction
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

enrollmentConfirmationStep.prototype.confirm = function confirm(data) {
  var self = this;
  self.enrollmentCompleteHub.removeAllListeners();

  var listenToEnrollmentCompleteTask = function listenToEnrollmentCompleteTask(done) {
    self.enrollmentCompleteHub.listenOnce(function onEnrollmentComplete(payload) {
      done(null, payload);
    });
  };

  var confirmTask = function confirmTask(done) {
    self.strategy.confirm(data, done);
  };

  async.all([
    listenToEnrollmentCompleteTask,
    confirmTask
  ], function onAllComplete(err, results) {
    self.enrollmentCompleteHub.removeAllListeners();

    if (err) {
      return self.emit('error', err);
    }

    var apiPayload = results[0];

    var payload = helpers.buildEnrollmentCompletePayload({
      txId: self.transaction.txId,
      apiPayload: apiPayload,
      method: self.strategy.method,
      enrollmentAttempt: self.enrollmentAttempt,
      enrollment: enrollmentBuilder(apiPayload.deviceAccount)
    });

    return self.emit('enrollment-complete', payload);
  });
};
