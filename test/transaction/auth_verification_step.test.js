'use strict';

const expect = require('chai').expect;
const btransaction = require('../../lib/transaction');
const benrollment = require('../../lib/entities/enrollment');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const botpAuthStrategy = require('../../lib/auth_strategies/otp_auth_strategy');
const bsmsAuthStrategy = require('../../lib/auth_strategies/sms_auth_strategy');
const bpnAuthStrategy = require('../../lib/auth_strategies/pn_auth_strategy');
const authVerificationStep = require('../../lib/transaction/auth_verification_step');
const GuardianError = require('../../lib/errors/guardian_error');

describe('transaction/auth_verification_step', function () {
  let httpClient;
  let transactionEventsReceiver;
  let transactionToken;
  let enrollment;
  let strategy;
  let enrolledTransaction;
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

    enrollment = benrollment({
      availableMethods: ['sms'],
      phoneNumber: '+1111111'
    });

    enrolledTransaction = btransaction({
      transactionToken,
      enrollmentAttempt: null,
      enrollments: [enrollment],
      availableEnrollmentMethods: ['push', 'otp', 'sms'],
      availableAuthenticationMethods: ['push', 'otp', 'sms']
    }, {
      httpClient,
      transactionEventsReceiver
    });
  });

  describe('for sms', function () {
    beforeEach(function () {
      strategy = bsmsAuthStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = authVerificationStep(strategy, {
        enrolledTransaction,
        loginCompleteHub: enrolledTransaction.loginCompleteHub,
        loginRejectedHub: enrolledTransaction.loginRejectedHub
      });
    });

    describe('#getMethod', function () {
      it('returns sms', function () {
        expect(step.getMethod()).to.equal('sms');
      });
    });

    describe('#verify', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'field_required');
            expect(err).to.have.property('field', 'otpCode');
            done();
          });

          step.verify({ otpCode: '' });
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

          step.verify({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, credentials, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(credentials.getToken()).to.equal('123.123.123');
            expect(data).to.eql({
              code: '123456',
              type: 'manual_input'
            });

            callback();
            done();
          };

          step.verify({ otpCode: '123456' });
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

            step.verify({ otpCode: '123456' });
          });
        });

        describe('when server returns ok and login:complete event is received', function () {
          beforeEach(function () {
            httpClient.post = sinon.spy(function (path, token, data, callback) {
              transactionEventsReceiver.emit('login:complete', {
                txId: 'tx_12345',
                signature: '123.123.123'
              });

              setImmediate(callback);
            });
          });

          it('emits auth-response', function (done) {
            step.on('auth-response', function (payload) {
              expect(payload).to.have.property('accepted', true);
              expect(payload).to.have.property('signature', '123.123.123');

              done();
            });

            step.verify({ otpCode: '123456' });
          });
        });
      });
    });
  });

  describe('for otp', function () {
    beforeEach(function () {
      strategy = botpAuthStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = authVerificationStep(strategy, {
        enrolledTransaction,
        loginCompleteHub: enrolledTransaction.loginCompleteHub,
        loginRejectedHub: enrolledTransaction.loginRejectedHub
      });
    });

    describe('#getMethod', function () {
      it('returns otp', function () {
        expect(step.getMethod()).to.equal('otp');
      });
    });

    describe('#verify', function () {
      describe('when otpCode is not provided', function () {
        it('emits FieldRequiredError', function (done) {
          step.on('error', function (err) {
            expect(err).to.exist;
            expect(err.stack).to.exist;
            expect(err).to.have.property('errorCode', 'field_required');
            expect(err).to.have.property('field', 'otpCode');
            done();
          });

          step.verify({ otpCode: '' });
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

          step.verify({ otpCode: 'ABCD234' });
        });
      });

      describe('when setup is ok', function () {
        it('calls the server for otp verification', function (done) {
          httpClient.post = function (path, credentials, data, callback) {
            expect(path).to.equal('api/verify-otp');
            expect(credentials.getToken()).to.equal('123.123.123');
            expect(data).to.eql({
              code: '123456',
              type: 'manual_input'
            });

            callback();
            done();
          };

          step.verify({ otpCode: '123456' });
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

            step.verify({ otpCode: '123456' });
          });
        });

        describe('when server returns ok and login:complete event is received', function () {
          beforeEach(function () {
            httpClient.post = sinon.spy(function (path, token, data, callback) {
              transactionEventsReceiver.emit('login:complete', {
                txId: 'tx_12345',
                signature: '123.123.123'
              });

              setImmediate(callback);
            });
          });

          it('emits auth-response', function (done) {
            step.on('auth-response', function (payload) {
              expect(payload).to.have.property('accepted', true);
              expect(payload).to.have.property('signature', '123.123.123');

              done();
            });

            step.verify({ otpCode: '123456' });
          });
        });
      });
    });
  });

  describe('for push', function () {
    beforeEach(function () {
      strategy = bpnAuthStrategy({
        transactionToken
      }, {
        httpClient
      });

      step = authVerificationStep(strategy, {
        enrolledTransaction,
        loginCompleteHub: enrolledTransaction.loginCompleteHub,
        loginRejectedHub: enrolledTransaction.loginRejectedHub
      });
    });

    describe('#getMethod', function () {
      it('returns push', function () {
        expect(step.getMethod()).to.equal('push');
      });
    });

    describe('#verify', function () {
      it('does not call the server', function (done) {
        process.nextTick(function () {
          expect(httpClient.post.called).to.be.false;
          done();
        });

        step.verify();
      });

      describe('when login:complete event is received', function () {
        it('emits auth-response for acceptance', function (done) {
          step.on('auth-response', function (payload) {
            expect(payload).to.have.property('accepted', true);
            expect(payload).to.have.property('signature', '123.123.123');

            done();
          });

          step.verify({ otpCode: '123456' });

          setImmediate(transactionEventsReceiver.emit.bind(transactionEventsReceiver),
            'login:complete', {
              txId: 'tx_12345',
              signature: '123.123.123'
            });
        });
      });

      describe('when login:rejected event is received', function () {
        it('emits auth-response for rejection', function (done) {
          step.on('auth-response', function (payload) {
            expect(payload).to.have.property('accepted', false);
            expect(payload.signature).not.to.exist;

            done();
          });

          step.verify({ otpCode: '123456' });

          setImmediate(transactionEventsReceiver.emit.bind(transactionEventsReceiver),
            'login:rejected', {
              txId: 'tx_12345'
            });
        });
      });
    });
  });
});
