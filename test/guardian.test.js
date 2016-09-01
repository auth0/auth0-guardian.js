'use strict';

const expect = require('chai').expect;
const GuardianJS = require('..');
const errors = require('../lib/errors');
const Transaction = require('../lib/transaction');

const sinon = require('sinon');

describe('Guardian.js', function() {
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
            requestToken: '123.123.123',
            tenant: {
              name: 'awesome',
              friendlyName: 'Awesome',
            },
          }, null, {
            guardianClient: { post }
          });

          return expect(guardianJS.start()).to.be.rejectedWith(errors.EnrollmentNotAllowedError);
        });
      });

      describe('and there is a factor enabled', function() {
        it('returns a transaction', function() {
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
            tenant: {
              name: 'awesome',
              friendlyName: 'Awesome',
            },
          }, null, {
            guardianClient: { post }
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
              tenant: {
                name: 'awesome',
                friendlyName: 'Awesome',
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
          });
        });
      });
    });

    describe('when user is enrolled', function() {
      it('returns a transaction', function() {

      });
    });

    expect(new GuardianJS({

    }, null, {

    }).start())
  });
});
