'use strict';

const chai = require('chai');
const OTPEnrollmentStrategy = require('../../../lib/enrollment/strategies/otp_enrollment_strategy');
const sinon = require('sinon');
const chaiAsPromised = require("chai-as-promised");
const errors = require('../../../lib/errors');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

const expect = chai.expect;

chai.use(chaiAsPromised);

describe('enrollment/strategies/otp_enrollment_strategy', function() {
  let socket;
  let transactionToken;
  let transactionTokenString;

  beforeEach(function() {
    socket = new EventEmitter();
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#enroll', function() {
    it('is callable and returns a promise', function() {
      return expect(new OTPEnrollmentStrategy({

        }, null, {

        }).enroll()).to.be.fulfilled;
    });
  });

  describe('#confirm', function() {
    describe('if otp code is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new OTPEnrollmentStrategy({
          transactionToken: transactionToken
        }, null, {
          guardianClient: { post },
          socket
        });

        return expect(flow.confirm({ otpCode: null })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if verify is accepted', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new OTPEnrollmentStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket
          });

        return expect(flow.confirm({ otpCode: '123456' })).to.be.fulfilled;
      });
    });

    describe('if verify is rejected', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.reject(new Error()));

        const flow = new OTPEnrollmentStrategy({
            transactionToken: transactionToken
          }, null, {
            guardianClient: { post },
            socket
          });

        return expect(flow.confirm({ otpCode: '123456' })).to.be.rejectedWith(Error);
      });
    });
  });

  describe('#getUri', function() {

    it('returns the correct url', function() {
      const post = sinon.stub().returns(Promise.reject(new Error()));

      const flow = new OTPEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            otpSecret: '1234555'
          },
          issuer: {
            name: 'mistery',
            label: 'Mistery'
          }
        }, null, {
          guardianClient: { post },
          socket
        });

      expect(flow.getUri()).to.equal('otpauth://totp/Mistery?secret=1234555');
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits login-complete', function() {
      it('calls the cb', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { signature: '123' };

        const strategy = new OTPEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            otpSecret: '1234555'
          },
          issuer: {
            name: 'mistery',
            label: 'Mistery'
          }
        }, null, {
          guardianClient: { post },
          socket
        });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: 'otp',
            enrollment: { status: 'confirmed' },
            transactionComplete: true,
            loginPayload: { signature: '123' }
          });

          done();
        });

        socket.emit('login-complete', payload);
      });
    });
  });
});
