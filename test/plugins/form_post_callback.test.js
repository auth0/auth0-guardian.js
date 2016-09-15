'use strict';

const expect = require('chai').expect;
const formPostCallbackBuilder = require('../../lib/plugins/form_post_callback');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;

describe('plugins/form_post_callback', function () {
  describe('with auto trigger', function () {
    describe('when login-complete is emitted', function () {
      describe('and when there is a before function', function () {
        it('post to server', (done) => {
          const events = new EventEmitter();
          const before = sinon.stub().yields();
          const post = (url, payload) => {
            expect(url).to.equal('http://test.com');
            expect(payload).to.eql({ signature: '123.123.123' });
            expect(before.called).to.be.true;

            done();
          };

          const formPostCallback = formPostCallbackBuilder({
            callbackUrl: 'http://test.com',
            autoTrigger: true,
            before
          }, { form: { post } });

          formPostCallback({ plugins: {}, events });

          events.emit('login-complete', { loginPayload: { signature: '123.123.123' } });
        });
      });

      describe('and when there is not a before function', function () {
        it('post to server', (done) => {
          const events = new EventEmitter();
          const post = (url, payload) => {
            expect(url).to.equal('http://test.com');
            expect(payload).to.eql({ signature: '123.123.123' });

            done();
          };

          const formPostCallback = formPostCallbackBuilder({
            callbackUrl: 'http://test.com',
            autoTrigger: true
          }, { form: { post } });

          formPostCallback({ plugins: {}, events });

          events.emit('login-complete', { loginPayload: { signature: '123.123.123' } });
        });
      });
    });
  });

  describe('without auto trigger', function () {
    let post;
    let guardianjs;

    describe('when login-complete is emitted', function () {
      describe('and when there is a before function', function () {
        beforeEach(function () {
          const events = new EventEmitter();
          post = sinon.stub();
          const before = sinon.stub().yields();

          const formPostCallback = formPostCallbackBuilder({
            callbackUrl: 'http://test.com',
            before
          }, { form: { post } });

          guardianjs = { plugins: {}, events };
          formPostCallback(guardianjs);

          events.emit('login-complete', { loginPayload: { signature: '123.123.123' } });
        });

        it('does not trigger post to server', (done) => {
          setTimeout(function () {
            expect(post.called).to.be.false;
            done();
          }, 100);
        });

        describe('when calling formPostCallback plugin', function () {
          it('post to the server', function () {
            guardianjs.plugins.formPostCallback();

            expect(post.called).to.be.true;
          });
        });
      });

      describe('and when there is not a before function', function () {
        beforeEach(function () {
          const events = new EventEmitter();
          post = sinon.stub();

          const formPostCallback = formPostCallbackBuilder({
            callbackUrl: 'http://test.com'
          }, { form: { post } });

          guardianjs = { plugins: {}, events };
          formPostCallback(guardianjs);

          events.emit('login-complete', { loginPayload: { signature: '123.123.123' } });
        });

        it('does not trigger post to server', (done) => {
          setTimeout(function () {
            expect(post.called).to.be.false;
            done();
          }, 100);
        });

        describe('when calling formPostCallback plugin', function () {
          it('post to the server', function () {
            guardianjs.plugins.formPostCallback();

            expect(post.called).to.be.true;
          });
        });
      });
    });
  });
});
