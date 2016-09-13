'use strict';

const expect = require('chai').expect;
const OTPAuthenticatorStrategy = require('../../../lib/auth/strategies/otp_authenticator_strategy');
const errors = require('../../../lib/errors');
const sinon = require('sinon');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

describe('auth/auth_flow/otp_authenticator_strategy', function() {
  let transactionToken;
  let transactionTokenString;

  beforeEach(function() {
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#request', function() {
    it('resolves the promise', function() {
      return expect(new OTPAuthenticatorStrategy({
      }, null, {
        guardianClient: {}
      }).request()).to.be.fulfilled;
    });
  });

  describe('#verify', function() {
    describe('when verificationData is not provided', function() {
      it('rejects with field required error', function() {
        return expect(new OTPAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {}
        }).verify()).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is not valid', function() {
      it('rejects with field required error', function() {
        expect(new OTPAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {}
        })
        .verify({ otpCode: '123456a' }))
        .to.be.rejectedWith(errors.OTPValidationError)
      });
    });

    describe('when otpCode is not provided', function() {
      it('rejects with field required error', function() {
        expect(new OTPAuthenticatorStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: {}
        }).verify({})).to.be.rejectedWith(errors.FieldRequiredError)
      });
    });

    describe('when otpCode is provided and it is valid', function() {

      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        return expect(new OTPAuthenticatorStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post }
          }).verify({ otpCode: '123456' })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/verify-otp');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.eql({ code: '123456', type: 'manual_input' });
          });
      });
    });
  });

});
