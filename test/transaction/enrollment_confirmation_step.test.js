'use strict';

const expect = require('chai').expect;
const btransaction = require('../../lib/transaction');
const benrollmentAttempt = require('../../lib/entities/enrollment_attempt');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const botpEnrollmentStrategy = require('../../lib/enrollment_strategies/otp_enrollment_strategy');
const bsmsEnrollmentStrategy = require('../../lib/enrollment_strategies/sms_enrollment_strategy');
const bpnEnrollmentStrategy = require('../../lib/enrollment_strategies/pn_enrollment_strategy');
const enrollmentConfirmationStep = require('../../lib/transaction/enrollment_confirmation_step');
const GuardianError = require('../../lib/errors/guardian_error');
const jwtToken = require('../../lib/utils/jwt_token');
const transactionFactory = require('../../lib/transaction/factory');

// eslint-disable-next-line
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjI5NTY0MzE2MjksInR4aWQiOiJ0eF8xMjM0NSIsImFkbWluIjp0cnVlfQ.KYkrYwJJg-QuG1IVtCs7q7y-532t50xk3f8jIXcmsJc';

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
      del: sinon.stub(),
      getBaseUrl: sinon.stub()
    };
    transactionEventsReceiver = new EventEmitter();
    transactionToken = jwtToken(token);

    const txOptions = {
      httpClient,
      transactionEventsReceiver
    };

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

    //
    // Creating a transaction, serializing it; then
    // deserialize using the factory in order to test
    // all functionality using that transaction
    // this will be enough proof that the ser/des works
    // fine
    // c = new C()
    // C.deserialize(c.serialize) == c;
    //
    const notEnrolledTransactionState = btransaction({
      transactionToken,
      enrollmentAttempt,
      enrollments: [],
      availableEnrollmentMethods: ['push', 'otp', 'sms'],
      availableAuthenticationMethods: ['push', 'otp', 'sms']
    }, txOptions).serialize();

    notEnrolledTransaction = transactionFactory.fromTransactionState(
      notEnrolledTransactionState, txOptions);
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

    describe('#getData', function () {
      it('returns null', function () {
        expect(step.getData()).to.equal(null);
      });
    });

    describe('#confirm', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
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
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'invalid_otp_format');
            done();
          });

          step.confirm({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, credentials, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(credentials.getToken()).to.equal(token);
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
              expect(err.stack).to.exist;
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
            httpClient.post = sinon.spy(function (path, t, data, callback) {
              transactionEventsReceiver.emit('enrollment:confirmed', {
                txId: 'tx_12345',
                method: 'sms',
                deviceAccount: {
                  phoneNumber: '+1234'
                }
              });

              setImmediate(callback);
            });
          });

          it('emits enrollment-complete', function (done) {
            step.on('enrollment-complete', function (payload) {
              expect(payload).to.have.property('recoveryCode', 'ABCDEFGHIJK');
              expect(payload).to.have.property('authRequired', false);
              expect(payload).to.have.property('enrollment');
              expect(payload.enrollment.getPhoneNumber()).to.equal('+1234');

              done();
            });

            step.confirm({ otpCode: '123456' });
          });
        });
      });
    });

    callbackBasedEnrollmentConfirmation();
  });

  describe('for otp', function () {
    beforeEach(function () {
      strategy = botpEnrollmentStrategy({
        transactionToken,
        enrollmentAttempt: {
          getIssuerName: sinon.stub().returns('awesome-tenant'),
          getOtpSecret: sinon.stub().returns('ABC123456'),
          getAccountLabel: sinon.stub().returns('Account Label')
        }
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
        expect(step.getUri()).to.equal('otpauth://totp/awesome-tenant:Account%20Label?secret=ABC123456&issuer=awesome-tenant');
      });
    });

    describe('#getData', function () {
      it('returns data that allows enrollment', function () {
        expect(step.getData()).to.eql({
          issuerName: 'awesome-tenant',
          otpSecret: 'ABC123456',
          accountLabel: 'Account Label'
        });
      });
    });

    describe('#confirm', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
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
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'invalid_otp_format');
            done();
          });

          step.confirm({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, credentials, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(credentials.getToken()).to.equal(token);
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
              expect(err.stack).to.exist;
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
            httpClient.post = sinon.spy(function (path, t, data, callback) {
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

    callbackBasedEnrollmentConfirmation();
  });

  describe('for push', function () {
    beforeEach(function () {
      strategy = bpnEnrollmentStrategy({
        transactionToken,
        enrollmentAttempt: {
          getIssuerLabel: sinon.stub().returns('Awesome tenant'),
          getOtpSecret: sinon.stub().returns('ABC123456'),
          getEnrollmentTransactionId: sinon.stub().returns('1234567'),
          getIssuerName: sinon.stub().returns('tenant'),
          getEnrollmentId: sinon.stub().returns('123456'),
          getBaseUri: sinon.stub().returns('https://me.too'),
          getAccountLabel: sinon.stub().returns('Account Label')
        }
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
        expect(step.getUri()).to.equal('otpauth://totp/tenant:Account%20Label?secret=ABC123456&' +
          'enrollment_tx_id=1234567&issuer=tenant&id=123456&' +
          'base_url=https%3A%2F%2Fme.too&algorithm=sha1&digits=6&counter=0&period=30');
      });
    });

    describe('#getData', function () {
      it('returns guardian url', function () {
        expect(step.getData()).to.eql({
          issuerLabel: 'Awesome tenant',
          otpSecret: 'ABC123456',
          enrollmentTransactionId: '1234567',
          issuerName: 'tenant',
          accountLabel: 'Account Label',
          enrollmentId: '123456',
          baseUrl: 'https://me.too',
          algorithm: 'sha1',
          digits: 6,
          counter: 0,
          period: 30
        });
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

  function callbackBasedEnrollmentConfirmation() {
    describe('when callback is provided', function () {
      describe('when otpCode is not provided', function () {
        it('callbacks with error FieldRequiredError', function (done) {
          step.confirm({ otpCode: '' }, function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'field_required');
            expect(err).to.have.property('field', 'otpCode');
            done();
          });
        });
      });

      describe('when otpCode has an invalid format', function () {
        it('callbacks with OTPValidationError', function (done) {
          step.confirm({ otpCode: 'ABCD234' }, function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'invalid_otp_format');
            done();
          });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          let path;
          let credentials;
          let data;

          httpClient.post = function (ipath, icredentials, idata, callback) {
            path = ipath;
            credentials = icredentials;
            data = idata;

            callback();
          };

          step.confirm({ otpCode: '123456' }, function (err) {
            expect(err).not.to.exist;
            expect(path).to.equal('api/verify-otp');
            expect(credentials.getToken()).to.equal(token);
            expect(data).to.eql({
              code: '123456',
              type: 'manual_input'
            });
            done();
          });
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

          it('callbacks with that error', function (done) {
            step.confirm({ otpCode: '123456' }, function (err) {
              expect(err).to.exist;
              expect(err.stack).to.exist;
              expect(err).to.have.property('errorCode', 'invalid_otp');
              expect(err).to.have.property('message', 'Invalid otp');
              expect(err).to.have.property('statusCode', 401);
              done();
            });
          });
        });

        describe('when server returns ok', function () {
          beforeEach(function () {
            httpClient.post = sinon.spy(function (path, t, data, callback) {
              transactionEventsReceiver.emit('enrollment:confirmed', {
                txId: 'tx_12345',
                method: 'sms',
                deviceAccount: {
                  phoneNumber: '+1234'
                }
              });

              setImmediate(callback);
            });
          });

          it('callbacks with no error and the recovery code', function (done) {
            step.confirm({ otpCode: '123456' }, function (err, payload) {
              expect(err).not.to.exist;
              expect(payload).to.have.property('recoveryCode', 'ABCDEFGHIJK');

              done();
            });
          });
        });
      });
    });
  }
});
