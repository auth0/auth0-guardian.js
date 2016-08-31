
const expect = require('chai').expect;
const OTPAuthenticatorStrategy = require('../../../lib/auth/strategies/otp_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');

describe('auth/auth_flow/otp_authenticator_strategy', function() {

  describe('#request', function() {
    it('resolves the promise', function() {
      expect(new OTPAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).request()).to.be.rejectedWith(errors.OperationNotAllowedError);
    });
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        expect(new OTPAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {}
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new OTPAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {}
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new OTPAuthenticatorStrategy({
            transactionToken: '123.123.123'
          }, null, {
            guardianClient: { post }
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

});
