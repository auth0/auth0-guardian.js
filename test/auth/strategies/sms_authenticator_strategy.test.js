
const expect = require('chai').expect;
const SMSAuthenticatorStrategy = require('../../../lib/auth/strategies/sms_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');

describe('auth/auth_flow/pn_authenticator_strategy', function() {
  let socket;

  beforeEach(function() {
    socket = { on: sinon.stub(), once: sinon.stub() };
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        expect(new SMSAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {},
          socket: socket
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new SMSAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {}
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new SMSAuthenticatorStrategy({
            transactionToken: '123.123.123'
          }, null, {
            guardianClient: { post },
            socket: socket
          }).verify({ otpCode: '123456' })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/verify-otp');
            expect(post.getCall(0).args[1]).to.equal('123.123.123');
            expect(post.getCall(0).args[2]).to.eql({ otpCode: '123456' });
          });
      });
    });
  });

  describe('#request', function() {
    describe('when succeed', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new SMSAuthenticatorStrategy({
            transactionToken: '123.123.123'
          }, null, {
            guardianClient: { post },
            socket: socket
          }).request()).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/send-sms');
            expect(post.getCall(0).args[1]).to.equal('123.123.123');
            expect(post.getCall(0).args[2]).to.equal(undefined);
          });
      });
    });
  });

});
