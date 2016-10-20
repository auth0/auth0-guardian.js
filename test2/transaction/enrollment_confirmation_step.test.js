'use strict';

const expect = require('chai').expect;
const btransaction = require('../../lib2/transaction');
const benrollmentAttempt = require('../../lib2/entities/enrollment_attempt');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const botpEnrollmentStrategy = require('../../lib2/enrollment_strategies/otp_enrollment_strategy');
const bsmsEnrollmentStrategy = require('../../lib2/enrollment_strategies/sms_enrollment_strategy');
const bpnEnrollmentStrategy = require('../../lib2/enrollment_strategies/pn_enrollment_strategy');
const enrollmentConfirmationStep = require('../../lib2/transaction/enrollment_confirmation_step');
const GuardianError = require('../../lib2/errors/guardian_error');

describe('transaction/auth_verificatin_step', function () {
  let httpClient;
  let transactionEventsReceiver;
  let transactionToken;
  let enrollmentAttempt;
  let strategy;
  let notEnrolledTransaction;
  let step;

  beforeEach(function () {
    httpClient = {
      post: sinon.stub(),
      get: sinon.stub(),
      put: sinon.stub(),
      patch: sinon.stub(),
      del: sinon.stub()
    };
    transactionEventsReceiver = new EventEmitter();
    transactionToken = new EventEmitter();
    transactionToken.getToken = sinon.stub().returns('123.123.123');
    transactionToken.getDecoded = sinon.stub().returns({
      txid: 'tx_12345'
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

  describe('for sms', function () {
    beforeEach(function () {
      strategy = bsmsEnrollmentStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = enrollmentConfirmationStep({
        strategy,
        transaction: notEnrolledTransaction,
        enrollmentCompleteHub: notEnrolledTransaction.enrollmentCompleteHub,
        enrollmentAttempt: notEnrolledTransaction.enrollmentAttempt
      });
    });

    describe('#getUri', function () {
      it('returns null', function () {
        expect(step.getUri()).to.equal(null);
      });
    });

    describe('#confirm', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err).to.have.property('errorCode', 'field_required');
            expect(err).to.have.property('field', 'otpCode');
            done();
          });

          step.confirm({ otpCode: '' });
        });
      });

      describe('when otpCode has an invalid format', function () {
        it('emits OTPValidationError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err).to.have.property('errorCode', 'invalid_otp_format');
            done();
          });

          step.confirm({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, token, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(token).to.equal('123.123.123');
            expect(data).to.eql({
              code: '123456',
              type: 'manual_input'
            });

            callback();
            done();
          };

          step.confirm({ otpCode: '123456' });
        });

        describe('when server returns an error', function () {
          let error;

          beforeEach(function () {
            error = new GuardianError({
              message: 'Invalid otp',
              errorCode: 'invalid_otp',
              statusCode: 401
            });

            httpClient.post.yields(error);
          });

          it('emits that error', function (done) {
            step.on('error', function (err) {
              expect(err).to.exist;
              expect(err).to.have.property('errorCode', 'invalid_otp');
              expect(err).to.have.property('message', 'Invalid otp');
              expect(err).to.have.property('statusCode', 401);
              done();
            });

            step.confirm({ otpCode: '123456' });
          });
        });

        describe('when server returns ok and enrollment:confirmed event is received', function () {
          beforeEach(function () {
            httpClient.post = sinon.spy(function (path, token, data, callback) {
              transactionEventsReceiver.emit('enrollment:confirmed', {
                txId: 'tx_12345',
                method: 'sms'
              });

              setImmediate(callback);
            });
          });

          it('emits enrollment-complete', function (done) {
            step.on('enrollment-complete', function (payload) {
              expect(payload).to.have.property('recoveryCode', 'ABCDEFGHIJK');
              expect(payload).to.have.property('authRequired', false);

              done();
            });

            step.confirm({ otpCode: '123456' });
          });
        });
      });
    });
  });

  describe('for otp', function () {
    beforeEach(function () {
      strategy = botpEnrollmentStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = enrollmentConfirmationStep({
        strategy,
        transaction: notEnrolledTransaction,
        enrollmentCompleteHub: notEnrolledTransaction.enrollmentCompleteHub,
        enrollmentAttempt: notEnrolledTransaction.enrollmentAttempt
      });
    });

    describe('#getUri', function () {
      it('returns otp url', function () {
        return 'otpauth://totp/Awesome%20tenant??secret=ABC123456';
      });
    });

    describe('#confirm', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err).to.have.property('errorCode', 'field_required');
            expect(err).to.have.property('field', 'otpCode');
            done();
          });

          step.confirm({ otpCode: '' });
        });
      });

      describe('when otpCode has an invalid format', function () {
        it('emits OTPValidationError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err).to.have.property('errorCode', 'invalid_otp_format');
            done();
          });

          step.confirm({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, token, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(token).to.equal('123.123.123');
            expect(data).to.eql({
              code: '123456',
              type: 'manual_input'
            });

            callback();
            done();
          };

          step.confirm({ otpCode: '123456' });
        });

        describe('when server returns an error', function () {
          let error;

          beforeEach(function () {
            error = new GuardianError({
              message: 'Invalid otp',
              errorCode: 'invalid_otp',
              statusCode: 401
            });

            httpClient.post.yields(error);
          });

          it('emits that error', function (done) {
            step.on('error', function (err) {
              expect(err).to.exist;
              expect(err).to.have.property('errorCode', 'invalid_otp');
              expect(err).to.have.property('message', 'Invalid otp');
              expect(err).to.have.property('statusCode', 401);
              done();
            });

            step.confirm({ otpCode: '123456' });
          });
        });

        describe('when server returns ok and enrollment:confirmed event is received', function () {
          beforeEach(function () {
            httpClient.post = sinon.spy(function (path, token, data, callback) {
              transactionEventsReceiver.emit('enrollment:confirmed', {
                txId: 'tx_12345',
                method: 'otp'
              });

              setImmediate(callback);
            });
          });

          it('emits enrollment-complete', function (done) {
            step.on('enrollment-complete', function (payload) {
              expect(payload).to.have.property('recoveryCode', 'ABCDEFGHIJK');
              expect(payload).to.have.property('authRequired', false);

              done();
            });

            step.confirm({ otpCode: '123456' });
          });
        });
      });
    });
  });

  describe('for push', function () {
    beforeEach(function () {
      strategy = bpnEnrollmentStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = enrollmentConfirmationStep({
        strategy,
        transaction: notEnrolledTransaction,
        enrollmentCompleteHub: notEnrolledTransaction.enrollmentCompleteHub,
        enrollmentAttempt: notEnrolledTransaction.enrollmentAttempt
      });
    });

    describe('#getUri', function () {
      it('returns guardian url', function () {
        return 'otpauth://totp/Awesome%20tenant??secret=ABC123456&' +
          'enrollment_tx_id=1234567&issuer=tenant&id=123456&' +
          'base_url=https%3A%2F%2Fme.too&algorithm=sha1&digits=6&counter=0&period=30';
      });
    });

    describe('#confirm', function () {
      it('does not call the server for otp verification', function (done) {
        step.confirm();

        process.nextTick(function () {
          expect(httpClient.post.called).to.be.false;
          expect(httpClient.get.called).to.be.false;
          expect(httpClient.put.called).to.be.false;
          expect(httpClient.patch.called).to.be.false;
          expect(httpClient.del.called).to.be.false;
          done();
        });
      });

      describe('when enrollment:confirmed event is received', function () {
        it('emits enrollment-complete', function (done) {
          step.on('enrollment-complete', function (payload) {
            expect(payload).to.have.property('recoveryCode', 'ABCDEFGHIJK');
            expect(payload).to.have.property('authRequired', true);

            done();
          });

          step.confirm({ otpCode: '123456' });

          process.nextTick(() => transactionEventsReceiver.emit('enrollment:confirmed', {
            txId: 'tx_12345',
            method: 'push'
          }));
        });
      });
    });
  });
});
