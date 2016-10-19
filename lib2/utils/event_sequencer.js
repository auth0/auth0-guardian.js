'use strict';

var object = require('./object');
var EventEmitter = require('events').EventEmitter;

/**
 * Controls the sequence of events, accepts events in any sequence and re-emits
 * them in the right sequence once it gets all the events in the sequence.
 * If no sequence is defined the event is re-emitted immediatelly.
 *
 * Useful to abstract transport layer timming issues and garantee a given
 * event sequence
 *
 * Assumed that there is a single event of each time on each the sequence
 * The sequences are assumed to be compatible, that is to say the sequence of
 * shared events must be the same in every sequence
 */
function eventSequencer() {
  var self = object.create(eventSequencer.prototype);
  EventEmitter.call(self);

  self.sequences = {};
  self.received = {};

  self.pipedEmitter = null;

  return self;
}

eventSequencer.prototype = object.create(EventEmitter.prototype);

eventSequencer.prototype.emit = function emit(eventName, payload) {
  var self = this;
  var sequences = this.getSequencesWithEvent(eventName);

  self.received[eventName] = { emitted: false, payload: payload };

  self.applySequences(sequences);

  // The event might not have been in any sequense, let's send it
  // right away then
  if (self.canEmitEventForSequences(sequences, eventName)) {
    self.doActualEmit(eventName);
  }
};

eventSequencer.prototype.applySequences = function applySequences(sequences) {
  var self = this;

  // This could be optimized if needed, but the expected sequences are just a few
  // and very short
  object.forEach(sequences, function controlledEmitter(sequence) {
    object.forEach(sequence, function emitTrial(seqEventName) {
      var eventSequences = self.getSequencesWithEvent(seqEventName);
      if (!self.canEmitEventForSequences(eventSequences, seqEventName)) {
        // We can not emit this event so we cannot emit following in the sequece
        // lets stop
        return false;
      }

      self.doActualEmit(seqEventName);
      return true;
    });
  });
};

eventSequencer.prototype.doActualEmit = function doActualEmit(eventName) {
  var self = this;
  var payload = self.received[eventName].payload;
  self.received[eventName].emitted = true;

  if (self.pipedEmitter) {
    self.pipedEmitter.emit(eventName, payload);
  }

  EventEmitter.prototype.emit.call(self, eventName, payload);
};

eventSequencer.prototype.canEmitEventForSequences =
  function canEmitEventForSequences(sequences, eventName) {
    var self = this;

    if (sequences.length === 0) {
      return true;
    }

    return object.every(sequences, function prevChecker(sequece) {
      return !self.haveToEmitOtherEventsBefore(sequece, eventName) &&
        self.canBeEmittedNow(eventName);
    });
  };

eventSequencer.prototype.haveToEmitOtherEventsBefore =
  function haveToEmitOtherEventsBefore(sequence, comparisonEventName) {
    var self = this;
    var comparisonEventIndex = sequence.indexOf(comparisonEventName);

    var isThereSomeNonEmittedPreviousEvent = false;
    object.forEach(sequence, function pendingFinder(eventName, index) {
      if (index >= comparisonEventIndex) {
      // Stop search
        return false;
      }

      if (!self.received[eventName] || !self.received[eventName].emitted) {
        isThereSomeNonEmittedPreviousEvent = true;
      // Stop search
        return false;
      }

    // Continue
      return true;
    });

    return isThereSomeNonEmittedPreviousEvent;
  };

eventSequencer.prototype.canBeEmittedNow = function canBeEmittedNow(eventName) {
  return this.received[eventName] && !this.received[eventName].emitted;
};

eventSequencer.prototype.getSequencesWithEvent = function getSequencesWithEvent(eventName) {
  var self = this;

  return object.filter(self.sequences, function sequenceFilter(seq) {
    return object.contains(seq, eventName);
  });
};

eventSequencer.prototype.addSequence = function addSequence(name, sequence) {
  this.sequences[name] = sequence;
};

eventSequencer.prototype.removeSequence = function removeSequence(name) {
  var self = this;
  var deletedSequence = this.sequences[name] || [];

  delete this.sequences[name];

  // Emit events that have been unblocked by deletion but that aren't in any
  // other sequence
  object.forEach(deletedSequence, function emitUnblocked(eventName) {
    if (self.canEmitEventForSequences(self.sequences, eventName)) {
      self.doActualEmit(eventName);
    }
  });

  this.applySequences(this.sequences);
};

eventSequencer.prototype.pipe = function pipe(emitter) {
  this.pipedEmitter = emitter;
};

module.exports = eventSequencer;
