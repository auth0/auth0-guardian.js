
const expect = require('chai').expect;
const PNAuthenticatorStrategy = require('../../../lib/auth/strategies/pn_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

describe('auth/auth_flow/pn_authenticator_strategy', function() {
  let socket;
  let transactionToken;
  let transactionTokenString;

  beforeEach(function() {
    socket = new EventEmitter();
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#verify', function() {
    it('resolves the promise', function() {
      return expect(new PNAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).verify()).to.be.fulfilled;
    });
  });

  describe('#request', function() {
    describe('when succeed', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new PNAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post }
          }).request()).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/send-push-notification');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.equal(undefined);
          });
      });
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits login-complete', function() {
      it('calls the cb for login', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { signature: '123' };

        const strategy = new PNAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket
          });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: 'push',
            recovery: false,
            accepted: true,
            loginPayload: payload
          });

          done();
        });

        socket.emit('login-complete', payload);
      });
    });

    describe('when socket emits login-rejected', function() {
      it('calls the cb for rejection', function(done) {
        const post = sinon.stub().returns(Promise.resolve());

        const strategy = new PNAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket
          });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: 'push',
            recovery: false,
            accepted: false,
            loginPayload: null
          });

          done();
        });

        socket.emit('login-rejected');
      });
    });
  });
});
