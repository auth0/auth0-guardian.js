'use strict';

const expect = require('chai').expect;
const eventListenerHub = require('../../lib2/utils/event_listener_hub');
const EventEmitter = require('events').EventEmitter;

describe('utils/event_listener_hub', function () {
  let hub;
  let emitter;

  beforeEach(function () {
    emitter = new EventEmitter();
    hub = eventListenerHub(emitter, 'test1');
  });

  describe('#listen', function () {
    it('listens to the event as many times as emitted', function (done) {
      const received = [];

      hub.listen(function (payload) {
        received.push(payload);
      });

      emitter.emit('test2', 'p3');
      emitter.emit('test1', 'p1');
      emitter.emit('test1', 'p2');

      setImmediate(function () {
        expect(received).to.eql(['p1', 'p2']);
        done();
      });
    });
  });

  describe('#listenOnce', function () {
    it('listens to the event only once', function (done) {
      const received = [];

      hub.listenOnce(function (payload) {
        received.push(payload);
      });

      emitter.emit('test2', 'p3');
      emitter.emit('test1', 'p1');
      emitter.emit('test1', 'p2');

      setImmediate(function () {
        expect(received).to.eql(['p1']);
        done();
      });
    });
  });

  describe('#defaultHandler', function () {
    describe('when another handler is defined', function () {
      it('does not call the default handler', function (done) {
        const received = [];

        hub.defaultHandler(function () {
          done(new Error('default handler should not have been called'));
        });

        hub.listenOnce(function (payload) {
          received.push(payload);
        });

        emitter.emit('test2', 'p3');
        emitter.emit('test1', 'p1');
        emitter.emit('test1', 'p2');

        setImmediate(function () {
          expect(received).to.eql(['p1']);
          done();
        });
      });
    });

    describe('when no other handler is defined', function () {
      it('calls the default handler', function (done) {
        const received = [];

        hub.defaultHandler(function (payload) {
          received.push(payload);
        });

        emitter.emit('test2', 'p3');
        emitter.emit('test1', 'p1');
        emitter.emit('test1', 'p2');

        setImmediate(function () {
          expect(received).to.eql(['p1', 'p2']);
          done();
        });
      });
    });
  });

  describe('#removeAllListeners', function () {
    it('removes all listeners', function (done) {
      hub.listenOnce(function () {
        done(new Error('listener should have been removed'));
      });

      hub.listen(function () {
        done(new Error('listener should have been removed'));
      });

      hub.listen(function () {
        done(new Error('listener should have been removed'));
      });

      hub.listenOnce(function () {
        done(new Error('listener should have been removed'));
      });

      hub.removeAllListeners();

      emitter.emit('test2', 'p3');
      emitter.emit('test1', 'p1');
      emitter.emit('test1', 'p2');

      setImmediate(done);
    });

    it('does not remove the default handler', function (done) {
      const received = [];

      hub.defaultHandler(function (payload) {
        received.push(payload);
      });

      hub.listenOnce(function () {
        done(new Error('listener should have been removed'));
      });

      hub.removeAllListeners();

      emitter.emit('test2', 'p3');
      emitter.emit('test1', 'p1');
      emitter.emit('test1', 'p2');

      setImmediate(function () {
        expect(received).to.eql(['p1', 'p2']);
        done();
      });
    });
  });
});
