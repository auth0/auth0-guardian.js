'use strict';

const expect = require('chai').expect;
const PNAuthenticatorStrategy = require('../../../lib/auth/strategies/pn_authenticator_strategy');
const sinon = require('sinon');
const JWTToken = require('../../../lib/utils/jwt_token');

describe('auth/auth_flow/pn_authenticator_strategy', function () {
  let transactionToken;
  let transactionTokenString;

  beforeEach(function () {
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#verify', function () {
    it('resolves the promise', function () {
      return expect(new PNAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).verify()).to.be.fulfilled;
    });
  });

  describe('#request', function () {
    describe('when succeed', function () {
      it('fulfills the promise', function () {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new PNAuthenticatorStrategy({
          transactionToken
        }, null, {
          guardianClient: { post }
        }).request()).to.be.fulfilled
          .then(function () {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/send-push-notification');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.equal(undefined);
          });
      });
    });
  });
});
