'use strict';

const expect = require('chai').expect;
const validations = require('../../lib/utils/validations');

describe('utils/validations', function() {
  describe('#validateOtp', function() {
    describe('when otp has less than 6 digits', function() {
      it('returns false', function() {
        expect(validations.validateOtp('12332')).to.be.false;
      });
    });

    describe('when otp has more than 6 digits', function() {
      it('returns false', function() {
        expect(validations.validateOtp('1233222')).to.be.false;
      });
    });

    describe('when otp has leters', function() {
      it('returns false', function() {
        expect(validations.validateOtp('13322a')).to.be.false;
      });
    });

    describe('when otp has is valid', function() {
      it('returns true', function() {
        expect(validations.validateOtp('555556')).to.be.true;
      });
    });
  });

  describe('#validateRecovery', function() {
    describe('when otp has less than 24 digits', function() {
      it('returns false', function() {
        expect(validations.validateRecoveryCode('12345678901234567890123')).to.be.false;
      });
    });

    describe('when otp has more than 24 digits', function() {
      it('returns false', function() {
        expect(validations.validateRecoveryCode('1234567890123456789012345')).to.be.false;
      });
    });

    describe('when otp has only numbers', function() {
      it('returns true', function() {
        expect(validations.validateRecoveryCode('123456789012345678901234')).to.be.true;
      });
    });

    describe('when otp has only leters', function() {
      it('returns true', function() {
        expect(validations.validateRecoveryCode('asdfghjklqwertyuiopzxcvb')).to.be.true;
      });
    });

    describe('when otp has letters and numbers', function() {
      it('returns true', function() {
        expect(validations.validateRecoveryCode('asdfghjklqwer4yui2pzxc1b')).to.be.true;
      });
    });
  });
});
