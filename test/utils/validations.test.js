'use strict';

const expect = require('chai').expect;
const validations = require('../../lib/utils/validations');

describe('utils/validations', function () {
  describe('#validateOtp', function () {
    describe('when otp has less than 6 digits', function () {
      it('returns false', function () {
        expect(validations.validateOtp('12332')).to.be.false;
      });
    });

    describe('when otp has more than 6 digits', function () {
      it('returns false', function () {
        expect(validations.validateOtp('1233222')).to.be.false;
      });
    });

    describe('when otp has leters', function () {
      it('returns false', function () {
        expect(validations.validateOtp('13322a')).to.be.false;
      });
    });

    describe('when otp has is valid', function () {
      it('returns true', function () {
        expect(validations.validateOtp('555556')).to.be.true;
      });
    });

    describe('when an explicit otpLength is provided', function () {
      it('accepts an otp matching the configured length', function () {
        expect(validations.validateOtp('1234567', 7)).to.be.true;
      });

      it('rejects an otp shorter than the configured length', function () {
        expect(validations.validateOtp('123456', 7)).to.be.false;
      });

      it('rejects an otp longer than the configured length', function () {
        expect(validations.validateOtp('12345678', 7)).to.be.false;
      });

      it('falls back to the default length of 6 when otpLength is not a number', function () {
        expect(validations.validateOtp('123456', undefined)).to.be.true;
        expect(validations.validateOtp('1234567', undefined)).to.be.false;
      });

      it('exposes DEFAULT_OTP_LENGTH as 6', function () {
        expect(validations.DEFAULT_OTP_LENGTH).to.equal(6);
      });
    });
  });

  describe('#validateRecovery', function () {
    describe('when otp has less than 24 digits', function () {
      it('returns false', function () {
        expect(validations.validateRecoveryCode('12345678901234567890123')).to.be.false;
      });
    });

    describe('when otp has more than 24 digits', function () {
      it('returns false', function () {
        expect(validations.validateRecoveryCode('1234567890123456789012345')).to.be.false;
      });
    });

    describe('when otp has only numbers', function () {
      it('returns true', function () {
        expect(validations.validateRecoveryCode('123456789012345678901234')).to.be.true;
      });
    });

    describe('when otp has only leters', function () {
      it('returns true', function () {
        expect(validations.validateRecoveryCode('asdfghjklqwertyuiopzxcvb')).to.be.true;
      });
    });

    describe('when otp has letters and numbers', function () {
      it('returns true', function () {
        expect(validations.validateRecoveryCode('asdfghjklqwer4yui2pzxc1b')).to.be.true;
      });
    });
  });
});
