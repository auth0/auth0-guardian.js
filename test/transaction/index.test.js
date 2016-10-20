'use strict';

const expect = require('chai').expect;
const btransaction = require('../../lib/transaction');
const benrollmentAttempt = require('../../lib/entities/enrollment_attempt');
const benrollment = require('../../lib/entities/enrollment');
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;

describe('transaction/index', function () {
  let httpClient;
  let transactionEventsReceiver;
  let transactionToken;
  let enrollmentAttempt;
  let enrollment;
  let enrolledTransaction;
  let notEnrolledTransaction;

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

  describe('events', function () {
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
        it('emit enrollment-complete event with ' +
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

    describe('auth-response', function () {
      describe('when login:complete is emitted', function () {
        it('emits auth-response', function (done) {
          notEnrolledTransaction.once('auth-response', (p) => {
            expect(p.signature).to.equal('123.123.123');
            expect(p.accepted).to.be.true;

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

            transactionEventsReceiver.emit('login:complete', {
              txId: 'tx_12345',
              signature: '123.123.123'
            });
          });
        });
      });

      describe('when login:complete is emitted before enrollment:complete', function () {
        it('emits the right sequence of events', function (done) {
          const received = [];

          notEnrolledTransaction.once('auth-response', () => {
            received.push('auth-response');

            expect(received).to.eql(['enrollment-complete', 'auth-response']);
            done();
          });

          notEnrolledTransaction.once('enrollment-complete', () => {
            received.push('enrollment-complete');
          });

          notEnrolledTransaction.enroll('push', null, function () {
            transactionEventsReceiver.emit('login:complete', {
              txId: 'tx_12345',
              signature: '123.123.123'
            });

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

  describe('#enroll', function () {
    describe('when you are already enrolled', function () {
      it('callbacks with an AlreadyEnrolledError', function (done) {
        enrolledTransaction.enroll('sms', null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'already_enrolled');
          done();
        });
      });
    });

    describe('when no enrollment method is available', function () {
      beforeEach(function () {
        notEnrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt,
          enrollments: [],
          availableEnrollmentMethods: [],
          availableAuthenticationMethods: ['push', 'otp', 'sms']
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with an NoMethodAvailableError', function (done) {
        notEnrolledTransaction.enroll('sms', null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'no_method_available');
          done();
        });
      });
    });

    describe('when requested enrollment method is disabled', function () {
      beforeEach(function () {
        notEnrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt,
          enrollments: [],
          availableEnrollmentMethods: ['push'],
          availableAuthenticationMethods: ['push', 'otp', 'sms']
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with an EnrollmentMethodDisabledError', function (done) {
        notEnrolledTransaction.enroll('sms', null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'enrollment_method_disabled');
          done();
        });
      });
    });

    describe('when requested enrollment method is active ' +
      'but it is not supported by the client', function () {
      beforeEach(function () {
        notEnrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt,
          enrollments: [],
          availableEnrollmentMethods: ['push', 'not_supported'],
          availableAuthenticationMethods: ['push', 'otp', 'sms']
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with an MethodNotFoundError', function (done) {
        notEnrolledTransaction.enroll('not_supported', null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'method_not_found');
          done();
        });
      });
    });

    describe('when setup works fine', function () {
      beforeEach(function () {
        httpClient.post.yields();
      });

      describe('for sms', function () {
        describe('and no phoneNumber is provided', function () {
          it('callbacks with FieldRequiredError', function (done) {
            notEnrolledTransaction.enroll('sms', { phoneNumber: '' }, function (err) {
              expect(err).to.exist;
              expect(err).to.have.property('errorCode', 'field_required');
              expect(err).to.have.property('field', 'phoneNumber');
              done();
            });
          });
        });

        describe('and phoneNumber is provided', function () {
          it('calls the service with the right data', function (done) {
            notEnrolledTransaction.enroll('sms', { phoneNumber: '+54 678909' }, function (err) {
              expect(err).not.to.exist;
              expect(httpClient.post.calledOnce).to.be.true;
              expect(httpClient.post.getCall(0).args[0]).to
                .equal('api/device-accounts/123456/sms-enroll');
              expect(httpClient.post.getCall(0).args[1]).to.eql('123.123.123');
              expect(httpClient.post.getCall(0).args[2]).to.eql({ phone_number: '+54 678909' });
              done();
            });
          });
        });
      });

      describe('for push', function () {
        beforeEach(function () {
          notEnrolledTransaction = btransaction({
            transactionToken,
            enrollmentAttempt,
            enrollments: [],
            availableEnrollmentMethods: ['push'],
            availableAuthenticationMethods: ['push', 'otp', 'sms']
          }, {
            httpClient,
            transactionEventsReceiver
          });
        });

        it('does not calls the api', function (done) {
          notEnrolledTransaction.enroll('push', null, function (err) {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.false;
            expect(httpClient.put.calledOnce).to.be.false;
            expect(httpClient.patch.calledOnce).to.be.false;
            expect(httpClient.del.calledOnce).to.be.false;
            expect(httpClient.get.calledOnce).to.be.false;
            done();
          });
        });
      });

      describe('for otp', function () {
        beforeEach(function () {
          notEnrolledTransaction = btransaction({
            transactionToken,
            enrollmentAttempt,
            enrollments: [],
            availableEnrollmentMethods: ['otp', 'push'],
            availableAuthenticationMethods: ['push', 'otp', 'sms']
          }, {
            httpClient,
            transactionEventsReceiver
          });
        });

        it('does not calls the api', function (done) {
          notEnrolledTransaction.enroll('otp', null, function (err) {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.false;
            expect(httpClient.put.calledOnce).to.be.false;
            expect(httpClient.patch.calledOnce).to.be.false;
            expect(httpClient.del.calledOnce).to.be.false;
            expect(httpClient.get.calledOnce).to.be.false;
            done();
          });
        });
      });

      it('returns a confirmation step', function (done) {
        notEnrolledTransaction.enroll('sms',
          { phoneNumber: '+54 678909' }, function (err, confirmationStep) {
            expect(confirmationStep.confirm).to.be.a('function');
            expect(confirmationStep.getUri).to.be.a('function');
            done();
          });
      });

      describe('and when confirmation step emits an error', function () {
        it('re emits the same error', function (done) {
          const error = new Error();

          notEnrolledTransaction.on('error', function (err) {
            expect(err).to.equal(error);
            done();
          });

          notEnrolledTransaction.enroll('sms',
                { phoneNumber: '+54 678909' }, function (err, confirmationStep) {
                  confirmationStep.emit('error', error);
                });
        });
      });

      describe('and when confirmation step emits an enrollment-complete', function () {
        it('re emits enrollment-complete with the same payload', function (done) {
          const payload = { payload: 'payload' };

          notEnrolledTransaction.on('enrollment-complete', function (p) {
            expect(p).to.equal(payload);
            done();
          });

          notEnrolledTransaction.enroll('sms',
            { phoneNumber: '+54 678909' }, function (err, confirmationStep) {
              confirmationStep.emit('enrollment-complete', payload);
            });
        });
      });
    });
  });

  describe('#requestAuth', function () {
    describe('when user is not enrolled', function () {
      it('callbacks with NotEnrolledError', function (done) {
        notEnrolledTransaction.requestAuth(benrollment({}), function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'not_enrolled');
          done();
        });
      });
    });

    describe('when no enrollment is provided', function () {
      it('callbacks with InvalidEnrollmentError', function (done) {
        enrolledTransaction.requestAuth(null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'invalid_enrollment');
          done();
        });
      });
    });

    describe('when there are not available methods in the enrollment', function () {
      beforeEach(function () {
        enrollment = benrollment({
          availableMethods: [],
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

      it('callbacks with InvalidEnrollmentError', function (done) {
        enrolledTransaction.requestAuth(null, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'invalid_enrollment');
          done();
        });
      });
    });

    describe('when there is not available authentication method', function () {
      beforeEach(function () {
        enrollment = benrollment({
          availableMethods: ['sms'],
          phoneNumber: '+1111111'
        });

        enrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt: null,
          enrollments: [enrollment],
          availableEnrollmentMethods: ['push', 'otp', 'sms'],
          availableAuthenticationMethods: []
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with NoMethodAvailableError', function (done) {
        enrolledTransaction.requestAuth(enrollment, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'no_method_available');
          done();
        });
      });
    });

    describe('when requested method is not available in ' +
      'the available authentication methods', function () {
      beforeEach(function () {
        enrollment = benrollment({
          availableMethods: ['sms'],
          phoneNumber: '+1111111'
        });

        enrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt: null,
          enrollments: [enrollment],
          availableEnrollmentMethods: ['push', 'otp', 'sms'],
          availableAuthenticationMethods: ['push']
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with AuthMethodDisabledError', function (done) {
        enrolledTransaction.requestAuth(enrollment, { method: 'other' }, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'auth_method_disabled');
          done();
        });
      });
    });

    describe('when strategy for method is not handled by the client', function () {
      beforeEach(function () {
        enrollment = benrollment({
          availableMethods: ['other'],
          phoneNumber: '+1111111'
        });

        enrolledTransaction = btransaction({
          transactionToken,
          enrollmentAttempt: null,
          enrollments: [enrollment],
          availableEnrollmentMethods: ['push', 'otp', 'sms'],
          availableAuthenticationMethods: ['other']
        }, {
          httpClient,
          transactionEventsReceiver
        });
      });

      it('callbacks with AuthMethodDisabledError', function (done) {
        enrolledTransaction.requestAuth(enrollment, { method: 'other' }, function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'method_not_found');
          done();
        });
      });
    });

    describe('when setup is ok', function () {
      beforeEach(function () {
        httpClient.post.yields();
      });

      describe('for sms', function () {
        it('request sms to the api', function (done) {
          enrolledTransaction.requestAuth(enrollment, { method: 'sms' }, function (err) {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.true;
            expect(httpClient.post.getCall(0).args[0]).to
              .equal('api/send-sms');
            expect(httpClient.post.getCall(0).args[1]).to.eql('123.123.123');
            expect(httpClient.post.getCall(0).args[2]).to.eql(null);
            done();
          });
        });
      });

      describe('for push', function () {
        beforeEach(function () {
          enrollment = benrollment({
            availableMethods: ['push'],
            name: 'Name'
          });

          enrolledTransaction = btransaction({
            transactionToken,
            enrollmentAttempt: null,
            enrollments: [enrollment],
            availableEnrollmentMethods: ['push', 'otp', 'sms'],
            availableAuthenticationMethods: ['push']
          }, {
            httpClient,
            transactionEventsReceiver
          });
        });

        it('request push to the api', function (done) {
          enrolledTransaction.requestAuth(enrollment, { method: 'push' }, function (err) {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.true;
            expect(httpClient.post.getCall(0).args[0]).to
              .equal('api/send-push-notification');
            expect(httpClient.post.getCall(0).args[1]).to.eql('123.123.123');
            expect(httpClient.post.getCall(0).args[2]).to.eql(null);
            done();
          });
        });
      });

      describe('for otp', function () {
        beforeEach(function () {
          enrollment = benrollment({
            availableMethods: ['otp']
          });

          enrolledTransaction = btransaction({
            transactionToken,
            enrollmentAttempt: null,
            enrollments: [enrollment],
            availableEnrollmentMethods: ['push', 'otp', 'sms'],
            availableAuthenticationMethods: ['push', 'otp']
          }, {
            httpClient,
            transactionEventsReceiver
          });
        });

        it('does not call the api', function (done) {
          enrolledTransaction.requestAuth(enrollment, { method: 'otp' }, function (err) {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.false;
            expect(httpClient.put.calledOnce).to.be.false;
            expect(httpClient.get.calledOnce).to.be.false;
            expect(httpClient.patch.calledOnce).to.be.false;
            expect(httpClient.del.calledOnce).to.be.false;
            done();
          });
        });
      });

      it('callbacks with a verification step', function (done) {
        enrolledTransaction.requestAuth(enrollment, { method: 'sms' },
          function (err, verificationStep) {
            expect(err).not.to.exist;
            expect(verificationStep.verify).to.be.a('function');
            done();
          });
      });

      describe('when verification step emits auth-response', function () {
        it('re emits the event', function (done) {
          const payload = { test: true };

          enrolledTransaction.on('auth-response', function (p) {
            expect(p).to.equal(payload);
            done();
          });

          enrolledTransaction.requestAuth(enrollment, { method: 'sms' },
            function (err, verificationStep) {
              verificationStep.emit('auth-response', payload);
            });
        });
      });

      describe('when verification step emits an error', function () {
        it('re emits the error', function (done) {
          const error = new Error();

          enrolledTransaction.on('error', function (p) {
            expect(p).to.equal(error);
            done();
          });

          enrolledTransaction.requestAuth(enrollment, { method: 'sms' },
            function (err, verificationStep) {
              verificationStep.emit('error', error);
            });
        });
      });
    });
  });

  describe('#recover', function () {
    describe('when no enrollment is available', function () {
      it('emits NotEnrolledError', function (done) {
        notEnrolledTransaction.on('error', function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'not_enrolled');
          done();
        });

        notEnrolledTransaction.recover({ recoveryCode: '123456789012345678901234' });
      });
    });

    describe('when recovery code format is invalid', function () {
      it('emits RecoveryCodeValidationError', function (done) {
        enrolledTransaction.on('error', function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'invalid_recovery_code_format');
          done();
        });

        enrolledTransaction.recover({ recoveryCode: '1234567890123456789ass' });
      });
    });

    describe('when recovery code is not provided', function () {
      it('emits FieldRequiredError', function (done) {
        enrolledTransaction.on('error', function (err) {
          expect(err).to.exist;
          expect(err).to.have.property('errorCode', 'field_required');
          expect(err).to.have.property('field', 'recoveryCode');
          done();
        });

        enrolledTransaction.recover({ recoveryCode: '' });
      });
    });

    describe('when recovery code is valid and servers sends the token', function () {
      beforeEach(function () {
        httpClient.post = sinon.spy(function (path, token, data, callback) {
          transactionEventsReceiver.emit('login:complete', {
            txId: 'tx_12345',
            signature: '123.456.789'
          });

          setImmediate(callback, null, {
            recoveryCode: '12345ABC'
          });
        });
      });

      it('emits auth-response with the new recovery code', function (done) {
        enrolledTransaction.on('auth-response', function (payload) {
          expect(payload.recoveryCode).to.equal('12345ABC');
          expect(payload.signature).to.equal('123.456.789');
          expect(payload.accepted).to.be.true;
          done();
        });

        enrolledTransaction.recover({ recoveryCode: '123456789012345678901234' });
      });
    });
  });

  describe('#isEnrolled', function () {
    describe('when there is at least one enrollment', function () {
      it('returns true', function () {
        expect(enrolledTransaction.isEnrolled()).to.be.true;
      });
    });

    describe('when there is no enrollment', function () {
      it('returns false', function () {
        expect(notEnrolledTransaction.isEnrolled()).to.be.false;
      });
    });
  });

  describe('#getEnrollments', function () {
    it('returns the enrollemnts', function () {
      expect(enrolledTransaction.getEnrollments()).to.eql([enrollment]);
    });
  });

  describe('#getAvailableEnrollmentMethods', function () {
    it('returns the available enrollment methods', function () {
      expect(notEnrolledTransaction.getAvailableEnrollmentMethods()).to.eql([
        'push', 'otp', 'sms'
      ]);
    });
  });
});
