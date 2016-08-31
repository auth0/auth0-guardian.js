
const expect = require('chai').expect;
const RecoveryCodeAuthenticatorStrategy = require('../../../lib/auth/strategies/recovery_code_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');

describe('auth/auth_flow/manual_authenticator_strategy', function() {

  describe('#request', function() {
    it('rejects the promise', function() {
      expect(new RecoveryCodeAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).request()).to.be.rejectedWith(errors.OperationNotAllowedError);
    });
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        expect(new RecoveryCodeAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {}
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when recoveryCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new RecoveryCodeAuthenticatorStrategy({
          transactionToken: '123'
        }, null, {
          guardianClient: {}
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new RecoveryCodeAuthenticatorStrategy({
            transactionToken: '123.123.123'
          }, null, {
            guardianClient: { post }
          }).verify({ recoveryCode: '123456' })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/recover-account');
            expect(post.getCall(0).args[1]).to.equal('123.123.123');
            expect(post.getCall(0).args[2]).to.eql({ recoveryCode: '123456' });
          });
      });
    });
  });

});
