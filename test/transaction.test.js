'use strict';

const expect = require('chai').expect;
const Transaction = require('../lib/transaction');
const AuthFlow = require('../lib/auth/auth_flow');
const EnrollmentFlow = require('../lib/enrollment/enrollment_flow');
const errors = require('../lib/errors');
const sinon = require('sinon');

describe('transaction', function () {
  let transactionToken;

  beforeEach(function () {
    transactionToken = {
      getToken: sinon.stub().returns('1234')
    };
  });

  describe('#isEnrolled', function () {
    describe('when user is already enrolled', function () {
      it('returns true', function () {
        expect(new Transaction({
          enrollment: {
            status: 'confirmed'
          }
        }, null, {}).isEnrolled()).to.be.true;
      });
    });

    describe('when user is not yet enrolled', function () {
      it('returns false', function () {
        expect(new Transaction({
          enrollment: {
            status: 'confirmation_pending'
          }
        }, null, {}).isEnrolled()).to.be.false;
      });
    });
  });

  describe('#canEnroll', function () {
    describe('when user is not yet enrolled', function () {
      it('returns false', function () {
        expect(new Transaction({
          enrollment: {
            status: 'confirmation_pending'
          }
        }, null, {}).canEnroll()).to.be.true;
      });
    });

    describe('when user is enrolled', function () {
      it('returns true', function () {
        expect(new Transaction({
          enrollment: {
            status: 'confirmed'
          }
        }, null, {}).canEnroll()).to.be.false;
      });
    });
  });

  describe('#startAuth', function () {
    describe('when user is not yet enrolled', function () {
      it('throws an error', function () {
        expect(function () {
          new Transaction({
            enrollment: {
              status: 'confirmation_pending'
            }
          }, null, {}).startAuth();
        }).to.throw(errors.NotEnrolledError);
      });
    });

    describe('when user is enrolled', function () {
      it('returns an auth flow', function () {
        const flow = new Transaction({
          enrollment: {
            status: 'confirmed'
          },
          transactionToken,
          factors: {
            sms: { enabled: true },
            push: { enabled: true }
          }
        }, null, {}).startAuth();

        expect(flow).to.be.an.instanceOf(AuthFlow);
        expect(flow.data).to.eql({
          transactionToken,
          enrollment: {
            status: 'confirmed'
          },
          factors: {
            sms: { enabled: true },
            push: { enabled: true }
          }
        });
      });
    });
  });

  describe('#startEnrollment', function () {
    describe('when user not is enrolled', function () {
      it('returns an enrollment flow', function () {
        const flow = new Transaction({
          enrollment: {
            status: 'confirmation_pending',
            recoveryCode: '1234'
          },
          issuer: {
            name: '123'
          },
          recoveryCode: '1234',
          enrollmentTxId: '1234',
          transactionToken,
          factors: {
            sms: { enabled: true },
            push: { enabled: true }
          }
        }, null, {}).startEnrollment();

        expect(flow).to.be.an.instanceOf(EnrollmentFlow);
        expect(flow.data).to.eql({
          transactionToken,
          enrollmentTxId: '1234',
          issuer: {
            name: '123'
          },
          enrollment: {
            status: 'confirmation_pending',
            recoveryCode: '1234'
          },
          recoveryCode: '1234',
          factors: {
            sms: { enabled: true },
            push: { enabled: true }
          }
        });
      });
    });


    describe('when user is enrolled', function () {
      it('throws an error', function () {
        expect(function () {
          new Transaction({
            enrollment: {
              status: 'confirmed',
              recoveryCode: '1234'
            },
            recoveryCode: '1234',
            enrollmentTxId: '1234',
            transactionToken,
            factors: {
              sms: { enabled: true },
              push: { enabled: true }
            }
          }, null, {}).startEnrollment();
        }).to.throw(errors.EnrollmentNotAllowedError);
      });
    });
  });
});
