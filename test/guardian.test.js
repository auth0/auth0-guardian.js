'use strict';

const expect = require('chai').expect;
const GuardianJS = require('..');
const errors = require('../lib/errors');
const Transaction = require('../lib/transaction');
const sinon = require('sinon');

describe('Guardian.js', function() {
  const getBaseUri = sinon.stub();

  describe('#start', function() {
    describe('when user is not enrolled', function() {
      describe('and there is no factor enabled', function() {
        it('rejects with an error', function() {
          const post = sinon.stub().returns(Promise.resolve({
            deviceAccount: {
              id: '123',
              status: 'confirmation_pending',
              otpSecret: '12345',
              recoveryCode: '123456789'
            },
            transactionToken: '123.123.123',
            enrollmentTxId: 'aaa',
            featureSwitches: {
              mfaSms: { enroll: false },
              mfaApp: { enroll: false },
            },
          }));

          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s',
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: { post, getBaseUri }
          });

          return expect(guardianJS.start()).to.be.rejectedWith(errors.EnrollmentNotAllowedError);
        });
      });

      describe('and there is a factor enabled', function() {
        it('returns a transaction', function() {
          const listenTo = sinon.stub();
          const post = sinon.stub().returns(Promise.resolve({
            deviceAccount: {
              id: '123',
              status: 'confirmation_pending',
              otpSecret: '12345',
              recoveryCode: '123456789'
            },
            transactionToken: '123.123.123',
            enrollmentTxId: 'aaa',
            featureSwitches: {
              mfaSms: { enroll: false },
              mfaApp: { enroll: true },
            },
          }));

          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: '123.123.123',
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: { post, listenTo, getBaseUri }
          });

          return expect(guardianJS.start()).to.be.fulfilled.then(function(tx) {
            expect(tx).to.be.instanceOf(Transaction);
            expect(tx.data).to.eql({
              enrollment: {
                id: '123',
                status: 'confirmation_pending',
                otpSecret: '12345',
                recoveryCode: '123456789',
              },
              issuer: {
                name: 'awesome',
                label: 'Awesome',
              },
              transactionToken: '123.123.123',
              recoveryCode: '123456789',
              enrollmentTxId: 'aaa',
              factors: {
                sms: {
                  enabled: false
                },
                push: {
                  enabled: true
                },
              },
            });

            expect(listenTo.called).to.be.true;
            expect(listenTo.getCall(0).args[0]).to.equal('login-complete');
            expect(listenTo.getCall(0).args[1]).to.equal('123.123.123');
            expect(listenTo.getCall(1).args[0]).to.equal('login-rejected');
            expect(listenTo.getCall(1).args[1]).to.equal('123.123.123');
            expect(listenTo.getCall(2).args[0]).to.equal('enrollment-complete');
            expect(listenTo.getCall(2).args[1]).to.equal('123.123.123');
            expect(listenTo.getCall(3).args[0]).to.equal('error');
            expect(listenTo.getCall(3).args[1]).to.equal('123.123.123');
          });
        });
      });
    });

    describe('when user is enrolled', function() {
      it('returns a transaction', function() {
        const listenTo = sinon.stub();
        const post = sinon.stub().returns(Promise.resolve({
          deviceAccount: {
            status: 'confirmed',
          },
          transactionToken: '123.123.123',
          featureSwitches: {
            mfaSms: { enroll: false },
            mfaApp: { enroll: true },
          },
        }));

        const guardianJS = new GuardianJS({
          serviceDomain: 'awesome.guardian.auth0.com',
          requestToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s',
          issuer: {
            name: 'awesome',
            label: 'Awesome',
          },
        }, null, {
          guardianClient: { post, listenTo, getBaseUri }
        });

        return expect(guardianJS.start()).to.be.fulfilled.then(function(tx) {
          expect(tx).to.be.instanceOf(Transaction);
          expect(tx.data).to.eql({
            enrollment: {
              status: 'confirmed',
            },
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
            transactionToken: '123.123.123',
            factors: {
              sms: {
                enabled: false
              },
              push: {
                enabled: true
              },
            },
          });

          expect(listenTo.called).to.be.true;
          expect(listenTo.getCall(0).args[0]).to.equal('login-complete');
          expect(listenTo.getCall(0).args[1]).to.equal('123.123.123');
          expect(listenTo.getCall(1).args[0]).to.equal('login-rejected');
          expect(listenTo.getCall(1).args[1]).to.equal('123.123.123');
          expect(listenTo.getCall(2).args[0]).to.equal('enrollment-complete');
          expect(listenTo.getCall(2).args[1]).to.equal('123.123.123');
          expect(listenTo.getCall(3).args[0]).to.equal('error');
          expect(listenTo.getCall(3).args[1]).to.equal('123.123.123');
        });
      });
    });
  });
});
