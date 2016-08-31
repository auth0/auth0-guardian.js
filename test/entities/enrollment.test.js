'use strict';

const expect = require('chai').expect;
const enrollment = require('../../lib/entities/enrollment');
const errors = require('../../lib/errors');

describe('entities/enrollment', function() {
  describe('#isEnrollmentConfirmed', function() {
    describe('when status is confirmed', function() {
      it('returns true', function() {
        expect(enrollment.isEnrollmentConfirmed({ status: 'confirmed' })).to.be.true;
      });
    });

    describe('when status is not confirmed', function() {
      it('returns false', function() {
        expect(enrollment.isEnrollmentConfirmed({ status: 'confirmation_pending' })).to.be.false;
      });
    });
  });
});
