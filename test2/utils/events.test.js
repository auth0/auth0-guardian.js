'use strict';

const expect = require('chai').expect;
const events = require('../../lib2/utils/events');
const EventEmitter = require('events').EventEmitter;

describe('utils/events', function () {
  describe('#onceAny', function () {
    let emitter;

    beforeEach(function () {
      emitter = new EventEmitter();
    });

    it('executes handler for the event', function (done) {
      events.onceAny(emitter, {
        test1() {
          done(new Error('Should not have been executed'));
        },
        test2(p) {
          expect(p).to.equal('payload-test-2');
          done();
        },
        test3() {
          done(new Error('Should not have been executed'));
        }
      });

      emitter.emit('test2', 'payload-test-2');
    });

    it('removes other listeners', function (done) {
      events.onceAny(emitter, {
        test1() {
          done(new Error('Should not have been executed'));
        },
        test2(p) {
          expect(p).to.equal('payload-test-2');
        },
        test3() {
          done(new Error('Should not have been executed'));
        }
      });

      emitter.emit('test2', 'payload-test-2');
      emitter.emit('test1', 'payload-test-1');
      setImmediate(done);
    });
  });
});
