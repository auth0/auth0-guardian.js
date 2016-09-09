
const expect = require('chai').expect;
const RecoveryCodeAuthenticatorStrategy = require('../../../lib/auth/strategies/recovery_code_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

describe('auth/auth_flow/otp_authenticator_strategy', function() {
  let socket;
  let transactionToken;
  let transactionTokenString;
  let hub;

  beforeEach(function() {
    hub = new EventEmitter();
    socket = new EventEmitter();
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#request', function() {
    it('resolves the promise', function() {
      return expect(new RecoveryCodeAuthenticatorStrategy({
      }, null, {
        guardianClient: {},
        socket: socket,
        hub: hub
      }).request()).to.be.fulfilled;
    });
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        expect(new RecoveryCodeAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {}
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when recoveryCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new RecoveryCodeAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {},
          socket: socket,
          hub: hub
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when recoveryCode is not valid', function() {
      it('rejects with field required error', function() {
        expect(new RecoveryCodeAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {},
          socket: socket,
          hub: hub
        })
        .verify({ recoveryCode: 'asdfghjklqwasdfghjklqw1234' }))
        .to.be.rejectedWith(errors.RecoveryCodeValidationError)
      });
    });

    describe('when recoveryCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new RecoveryCodeAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket,
            hub: hub
          }).verify({ recoveryCode: '12345678901234567890asdf' })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/recover-account');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.eql({ recoveryCode: '12345678901234567890asdf' });
          });
      });
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits login-complete', function() {
      it('calls the cb', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { signature: '123' };

        const strategy = new RecoveryCodeAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket: socket,
            hub: hub
          });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: null,
            recovery: true,
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
