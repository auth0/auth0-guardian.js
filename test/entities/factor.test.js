'use strict';

const expect = require('chai').expect;
const factor = require('../../lib/entities/factor');

describe('entities/factor', function () {
  describe('#isAnyFactorEnabled', function () {
    describe('when any factor is enabled', function () {
      it('returns true', function () {
        expect(factor.isAnyFactorEnabled({
          a: { enabled: false },
          b: { enabled: true },
          c: { enabled: false }
        })).to.be.true;
      });
    });

    describe('when no factor is enabled', function () {
      it('returns false', function () {
        expect(factor.isAnyFactorEnabled({
          a: { enabled: false },
          b: { enabled: false }
        })).to.be.false;
      });
    });
  });

  describe('#getAvailableFactors', function () {
    describe('for type push', function () {
      it('returns authenticator and push', function () {
        expect(factor.getAvailableFactors({
          sms: { enabled: false },
          push: { enabled: true }
        })).to.eql(['push', 'otp']);
      });
    });

    describe('for type sms and push', function () {
      it('returns authenticator, push and otp', function () {
        expect(factor.getAvailableFactors({
          sms: { enabled: true },
          push: { enabled: true }
        }))
        .to.eql(['sms', 'push', 'otp']);
      });
    });
  });
});
