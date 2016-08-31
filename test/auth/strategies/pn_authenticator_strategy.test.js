
const expect = require('chai').expect;
const PNAuthenticatorStrategy = require('../../../lib/auth/strategies/pn_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');

describe('auth/auth_flow/pn_authenticator_strategy', function() {

  describe('#verify', function() {
    it('rejects the promise', function() {
      expect(new PNAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).verify()).to.be.rejectedWith(errors.OperationNotAllowedError);
    });
  });

  describe('#request', function() {
    describe('when succeed', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new PNAuthenticatorStrategy({
            transactionToken: '123.123.123'
          }, null, {
            guardianClient: { post }
          }).request()).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/send-push-notification');
            expect(post.getCall(0).args[1]).to.equal('123.123.123');
            expect(post.getCall(0).args[2]).to.equal(undefined);
          });
      });
    });
  });

});
