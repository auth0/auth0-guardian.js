'use strict';

const expect = require('chai').expect;
const SMSAuthenticatorStrategy = require('../../../lib/auth/strategies/sms_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

describe('auth/auth_flow/sms_authenticator_strategy', function() {
  let socket;
  let transactionToken;
  let transactionTokenString;

  beforeEach(function() {
    socket = new EventEmitter();
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        expect(new SMSAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {},
          socket: socket
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new SMSAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {}
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new SMSAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket
          }).verify({ otpCode: '123456' })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/verify-otp');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.eql({ type: 'manual_input', code: '123456' });
          });
      });
    });
  });

  describe('#request', function() {
    describe('when succeed', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new SMSAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket
          }).request()).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/send-sms');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.equal(undefined);
          });
      });
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits login-complete', function() {
      it('calls the cb', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { signature: '123' };

        const strategy = new SMSAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket
          });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: 'sms',
            recovery: false,
            accepted: true,
            loginPayload: payload
          });

          done();
        });

        socket.emit('login-complete', payload);
      });
    });
  });
});
