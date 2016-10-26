'use strict';

const expect = require('chai').expect;
const eventSequence = require('../../lib/utils/event_sequencer');
const EventEmitter = require('events').EventEmitter;

describe('utils/event_sequences', function () {
  describe('when event is not in a sequence', function () {
    let iEventSequence;
    let events;

    beforeEach(function () {
      events = new EventEmitter();
      iEventSequence = eventSequence();
      iEventSequence.pipe(events);
    });

    it('emits the event in the piped stream', function (done) {
      events.on('test', function (p) {
        expect(p).to.equal('payload');
        done();
      });

      iEventSequence.emit('test', 'payload');
    });
  });

  describe('when event is in a sequence', function () {
    let iEventSequence;
    let events;

    beforeEach(function () {
      events = new EventEmitter();
      iEventSequence = eventSequence();
      iEventSequence.pipe(events);
    });

    it('emits the event in the right sequence', function (done) {
      const received = [];

      events.on('test-2', function (p) {
        received.push({ name: 'test-2', payload: p });
      });

      events.on('test-1', function (p) {
        received.push({ name: 'test-1', payload: p });
      });

      events.on('test-3', function (p) {
        received.push({ name: 'test-3', payload: p });
      });

      events.on('other', function (p) {
        received.push({ name: 'other', payload: p });
      });

      events.on('test-4', function (p) {
        received.push({ name: 'test-4', payload: p });

        expect(received).to.eql([
          { name: 'other', payload: 'payloadOther' },
          { name: 'test-1', payload: 'payload1' },
          { name: 'test-2', payload: 'payload2' },
          { name: 'test-3', payload: 'payload3' },
          { name: 'test-4', payload: 'payload4' }
        ]);

        done();
      });

      iEventSequence.addSequence('s1', ['test-1', 'test-2', 'test-3', 'test-4']);
      iEventSequence.addSequence('s2', ['other', 'test-1', 'test-2', 'test-3', 'test-4']);

      iEventSequence.emit('test-3', 'payload3');
      iEventSequence.emit('test-1', 'payload1');
      iEventSequence.emit('test-4', 'payload4');
      iEventSequence.emit('test-2', 'payload2');
      iEventSequence.emit('other', 'payloadOther');
    });
  });

  describe('after removing a bloking sequence', function () {
    let iEventSequence;
    let events;

    beforeEach(function () {
      events = new EventEmitter();
      iEventSequence = eventSequence();
      iEventSequence.pipe(events);
    });

    it('emits the event in the right sequence', function (done) {
      const received = [];

      events.on('test-2', function (p) {
        received.push({ name: 'test-2', payload: p });
      });

      events.on('test-1', function (p) {
        received.push({ name: 'test-1', payload: p });
      });

      events.on('test-3', function (p) {
        received.push({ name: 'test-3', payload: p });
      });

      events.on('other-1', function (p) {
        received.push({ name: 'other-1', payload: p });
      });

      events.on('test-4', function (p) {
        received.push({ name: 'test-4', payload: p });

        expect(received).to.eql([
          { name: 'other-1', payload: 'payloadOther1' },
          { name: 'test-1', payload: 'payload1' },
          { name: 'test-2', payload: 'payload2' },
          { name: 'test-3', payload: 'payload3' },
          { name: 'test-4', payload: 'payload4' }
        ]);

        done();
      });

      iEventSequence.addSequence('s1', ['test-1', 'test-2', 'test-3', 'test-4']);
      iEventSequence.addSequence('s2', [
        'other', 'other-1', 'test-1', 'test-2', 'test-3', 'test-4']);

      iEventSequence.emit('test-3', 'payload3');
      iEventSequence.emit('test-1', 'payload1');
      iEventSequence.emit('test-4', 'payload4');
      iEventSequence.emit('test-2', 'payload2');
      iEventSequence.emit('other-1', 'payloadOther1');
      iEventSequence.removeSequence('s2');
    });
  });
});
