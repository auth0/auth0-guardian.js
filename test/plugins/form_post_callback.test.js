'use strict';

const expect = require('chai').expect;
const formPostCallbackBuilder = require('../../lib/plugins/form_post_callback');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;

describe('plugins/form_post_callback', function() {
  describe('when login-complete is emitted', function() {
    describe('and when there is a before function', function() {
      it('post to server', function(done) {
        const events = new EventEmitter();
        const post = (url, payload) => {
          expect(url).to.equal('http://test.com');
          expect(payload).to.eql({ signature: '123.123.123' });
          expect(before.called).to.be.true;

          done();
        };
        const before = sinon.stub().yields();

        const formPostCallback = formPostCallbackBuilder({
          callbackUrl: 'http://test.com',
          before
        }, { form: { post } });

        formPostCallback({ events });

        events.emit('login-complete', { signature: '123.123.123' });
      });
    });

    describe('and when there is not a before function', function() {
      it('post to server', function(done) {
        const events = new EventEmitter();
        const post = (url, payload) => {
          expect(url).to.equal('http://test.com');
          expect(payload).to.eql({ signature: '123.123.123' });

          done();
        };

        const formPostCallback = formPostCallbackBuilder({
          callbackUrl: 'http://test.com'
        }, { form: { post } });

        formPostCallback({ events });

        events.emit('login-complete', { signature: '123.123.123' });
      });
    });
  });
});
