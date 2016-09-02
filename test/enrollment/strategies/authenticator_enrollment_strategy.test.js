const chai = require('chai');
const OTPEnrollmentStrategy = require('../../../lib/enrollment/strategies/otp_enrollment_strategy');
const sinon = require('sinon');
const chaiAsPromised = require("chai-as-promised");
const errors = require('../../../lib/errors');

const expect = chai.expect;

chai.use(chaiAsPromised);

describe('enrollment/strategies/otp_enrollment_strategy', function() {

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
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.confirm({ otpCode: null })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if verify is accepted', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new OTPEnrollmentStrategy({
            transactionToken: '1234'
          }, null, {
            guardianClient: { post }
          });

        return expect(flow.confirm({ otpCode: '123456' })).to.be.fulfilled;
      });
    });

    describe('if verify is rejected', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.reject(new Error()));

        const flow = new OTPEnrollmentStrategy({
            transactionToken: '1234'
          }, null, {
            guardianClient: { post }
          });

        return expect(flow.confirm({ otpCode: '123456' })).to.be.rejectedWith(Error);
      });
    });
  });

  describe('#getUri', function() {

    it('returns the correct url', function() {
      const post = sinon.stub().returns(Promise.reject(new Error()));

      const flow = new OTPEnrollmentStrategy({
          transactionToken: '1234',
          enrollment: {
            otpSecret: '1234555'
          },
          issuer: {
            name: 'mistery',
            label: 'Mistery'
          }
        }, null, {
          guardianClient: { post }
        });

      expect(flow.getUri()).to.equal('otpauth://totp/Mistery?secret=1234555');
    });
  });
});
