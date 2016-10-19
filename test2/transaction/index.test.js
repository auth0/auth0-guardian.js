'use strict';

const expect = require('chai').expect;
const btransaction = require('../../lib2/transaction');
const benrollmentAttempt = require('../../lib2/entities/enrollment_attempt');
const benrollment = require('../../lib2/entities/enrollment');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;

describe('transaction/index', function () {
  let httpClient;
  let transactionEventsReceiver;
  let transactionToken;
  let enrollmentAttempt;
  let enrollment;
  let transaction;
  let notEnrolledTransaction;

  beforeEach(function () {
    httpClient = {};
    transactionEventsReceiver = new EventEmitter();
    transactionToken = new EventEmitter();
    transactionToken.getToken = sinon.stub().returns('123.123.123');
    transactionToken.getDecoded = sinon.stub().returns({
      txid: 'tx_12345'
    });

    enrollment = benrollment({
      availableMethods: [],
      name: 'my-name',
      phoneNumber: '+1111111'
    });

    enrollmentAttempt = benrollmentAttempt({
      enrollmentTxId: '1234567',
      otpSecret: 'ABC123456',
      issuer: {
        name: 'tenant',
        label: 'Awesome tenant'
      },
      recoveryCode: 'ABCDEFGHIJK',
      enrollmentId: '123456',
      baseUrl: 'https://me.too/'
    });

    notEnrolledTransaction = btransaction({
      transactionToken,
      enrollmentAttempt,
      enrollments: [],
      availableEnrollmentMethods: ['push', 'otp', 'sms'],
      availableAuthenticationMethods: ['push', 'otp', 'sms']
    }, {
      httpClient,
      transactionEventsReceiver
    });
  });

  describe('general events', function () {
    describe('when transaction-token expires', function () {
      it('emits timeout', function (done) {
        notEnrolledTransaction.once('timeout', () => done());
        transactionToken.emit('token-expired');
      });
    });

    describe('when error is sent to transactionEventsReceiver', function () {
      it('emits error', function (done) {
        const err = new Error();

        notEnrolledTransaction.once('error', (iError) => {
          expect(iError).to.equal(err);
          done();
        });

        transactionEventsReceiver.emit('error', err);
      });
    });

    describe('enrollment-complete', function () {
      describe('when there is no active enrollment attempt and it ' +
        'was not generated in this tx', function () {
        it('emit enrollment-complete event with no ' +
          'recoveryCode and authRequired = true', function (done) {
          notEnrolledTransaction.once('enrollment-complete', (p) => {
            expect(p.recoveryCode).not.to.exist;
            expect(p.authRequired).to.be.true;
            done();
          });

          transactionEventsReceiver.emit('enrollment:confirmed', {
            txId: 'tx_other',
            method: 'sms',
            deviceAccount: {
              availableMethods: ['sms'],
              phoneNumber: '+54 3416 77777777'
            }
          });
        });

        it('adds the enrollment to the transaction', function (done) {
          notEnrolledTransaction.once('enrollment-complete', () => {
            expect(notEnrolledTransaction.isEnrolled()).to.be.true;

            const newEnrollment = notEnrolledTransaction.getEnrollments()[0];

            expect(newEnrollment.getName()).to.equal(undefined);
            expect(newEnrollment.getPhoneNumber()).to.equal('+54 3416 77777777');
            expect(newEnrollment.getAvailableMethods()).to.eql(['sms']);
            done();
          });

          transactionEventsReceiver.emit('enrollment:confirmed', {
            txId: 'tx_other',
            method: 'sms',
            deviceAccount: {
              availableMethods: ['sms'],
              phoneNumber: '+54 3416 77777777'
            }
          });
        });
      });

      describe('when there is an active enrollment attempt and it ' +
        'does not includes the transaction id', function () {
        it('emit enrollment-complete event with no ' +
          'recoveryCode and authRequired = true', function (done) {
          notEnrolledTransaction.once('enrollment-complete', (p) => {
            expect(p.recoveryCode).to.equal('ABCDEFGHIJK');
            expect(p.authRequired).to.be.true;
            done();
          });

          notEnrolledTransaction.enroll('push', null, function () {
            transactionEventsReceiver.emit('enrollment:confirmed', {
              txId: null,
              method: 'push',
              deviceAccount: {
                availableMethods: ['push'],
                name: 'Test'
              }
            });
          });
        });

        it('adds the enrollment to the transaction', function (done) {
          notEnrolledTransaction.once('enrollment-complete', () => {
            expect(notEnrolledTransaction.isEnrolled()).to.be.true;

            const newEnrollment = notEnrolledTransaction.getEnrollments()[0];

            expect(newEnrollment.getName()).to.equal('Test');
            expect(newEnrollment.getPhoneNumber()).to.equal(undefined);
            expect(newEnrollment.getAvailableMethods()).to.eql(['push', 'otp']);
            done();
          });

          notEnrolledTransaction.enroll('push', null, function () {
            transactionEventsReceiver.emit('enrollment:confirmed', {
              txId: null,
              method: 'push',
              deviceAccount: {
                availableMethods: ['push', 'otp'],
                name: 'Test'
              }
            });
          });
        });
      });

      describe('when there is an active enrollment attempt and it ' +
        'includes the transaction id', function () {
        it('emit enrollment-complete event with ' +
          'recoveryCode and authRequired = true', function (done) {
          notEnrolledTransaction.once('enrollment-complete', (p) => {
            expect(p.recoveryCode).to.equal('ABCDEFGHIJK');
            expect(p.authRequired).to.be.true;
            done();
          });

          notEnrolledTransaction.enroll('push', null, function () {
            transactionEventsReceiver.emit('enrollment:confirmed', {
              txId: 'tx_12345',
              method: 'push',
              deviceAccount: {
                availableMethods: ['push'],
                name: 'Test'
              }
            });
          });
        });

        it('adds the enrollment to the transaction', function (done) {
          notEnrolledTransaction.once('enrollment-complete', () => {
            expect(notEnrolledTransaction.isEnrolled()).to.be.true;

            const newEnrollment = notEnrolledTransaction.getEnrollments()[0];

            expect(newEnrollment.getName()).to.equal('Test');
            expect(newEnrollment.getPhoneNumber()).to.equal(undefined);
            expect(newEnrollment.getAvailableMethods()).to.eql(['push', 'otp']);
            done();
          });

          notEnrolledTransaction.enroll('push', null, function () {
            transactionEventsReceiver.emit('enrollment:confirmed', {
              txId: 'tx_12345',
              method: 'push',
              deviceAccount: {
                availableMethods: ['push', 'otp'],
                name: 'Test'
              }
            });
          });
        });
      });
    });
  });
});
