'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const nullClient = require('../lib/utils/null_client');
const guardianjsb = require('../lib');
const jwtToken = require('../lib/utils/jwt_token');

describe('guardian.js', function () {
  let httpClient;
  let socketClient;
  let guardianjs;
  let requestToken;
  let expiredRequestToken;
  let transactionToken;

  beforeEach(function () {
    // eslint-disable-next-line
    requestToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjI5NTY0MzE2MjksInR4aWQiOiIyYTliNWI2YjQzYjFiNmIyYjkiLCJhZG1pbiI6dHJ1ZX0.aTyyFsDSWrbxfxbCbr7vJs3fB6P67tCGDb6pI-r7woM';
    // eslint-disable-next-line
    expiredRequestToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE0NzgyMTU4OTUsInR4aWQiOiIyYTliNWI2YjQzYjFiNmIyYjkiLCJhZG1pbiI6dHJ1ZX0.uh1zReZTrdFqLhrxPTDHO7ChA-O4sNMOnUp7EbPi7ts';
    // eslint-disable-next-line
    transactionToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE0NzgyMTU4OTUwMDAwMDAsInR4aWQiOiIyYTliNWI2YjQzYjFiNmIyYjkiLCJhZG1pbiI6dHJ1ZX0.E5-_n8sdEyZ1RuDUdMJr9JSJB0AuE4ODMyVGIrG8Jg8';

    httpClient = {
      post: sinon.stub(),
      get: sinon.stub(),
      put: sinon.stub(),
      patch: sinon.stub(),
      del: sinon.stub(),
      getBaseUrl: sinon.stub().returns('https://tenant.guardian.auth0.com')
    };

    socketClient = {
      connect: sinon.stub(),
      on: sinon.stub()
    };
  });

  describe('#start', function () {
    describe('when request token is expired', function () {
      beforeEach(function () {
        guardianjs = guardianjsb({
          serviceUrl: 'https://tenant.guardian.auth0.com',
          requestToken: expiredRequestToken,
          issuer: {
            label: 'label',
            name: 'name'
          },
          accountName: 'accountName',
          globalTrackingId: 'globalTrackingId',
          dependencies: {
            httpClient,
            socketClient
          }
        });
      });

      it('callbacks with credentials_expired', function (done) {
        guardianjs.start((err) => {
          expect(err).to.exist;
          expect(err.errorCode).to.equal('credentials_expired');
          done();
        });
      });
    });

    describe('when request token is not expired', function () {
      describe('and when http client post callbacks with an exception', function () {
        let error;

        beforeEach(function () {
          error = new Error();
          httpClient.post.yields(error);

          guardianjs = guardianjsb({
            serviceUrl: 'https://tenant.guardian.auth0.com',
            requestToken,
            issuer: {
              label: 'label',
              name: 'name'
            },
            accountName: 'accountName',
            globalTrackingId: 'globalTrackingId',
            dependencies: {
              httpClient,
              socketClient
            }
          });
        });

        it('callbacks with an error', function (done) {
          guardianjs.start((err) => {
            expect(err).to.exist;
            expect(err).to.equal(error);
            done();
          });
        });
      });

      describe('and when socket client callbacks with an exception', function () {
        let error;

        beforeEach(function () {
          error = new Error();
          httpClient.post.yields(null, {
            transactionToken
          });
          socketClient.connect.yields(error);

          guardianjs = guardianjsb({
            serviceUrl: 'https://tenant.guardian.auth0.com',
            requestToken,
            issuer: {
              label: 'label',
              name: 'name'
            },
            accountLabel: 'accountLabel',
            globalTrackingId: 'globalTrackingId',
            dependencies: {
              httpClient,
              socketClient
            }
          });
        });

        it('callbacks with an error', function (done) {
          guardianjs.start((err) => {
            expect(err).to.exist;
            expect(err).to.equal(error);
            done();
          });
        });
      });

      describe('when jwtToken fails', function () {
        let response;
        let jwtTokenFunc;

        beforeEach(function () {
          response = {
            deviceAccount: {
              methods: ['otp'],
              availableMethods: ['otp'],
              name: 'test',
              phoneNumber: '+1234'
            },
            availableEnrollmentMethods: ['otp'],
            availableAuthenticationMethods: ['push'],
            transactionToken
          };

          socketClient.connect.yields();
          httpClient.post.yields(null, response);

          jwtTokenFunc = jwtToken;
          const guardianStubbed = proxyquire.noPreserveCache()('../lib', {
            // eslint-disable-next-line
            './utils/jwt_token': function() { return jwtTokenFunc.apply(this, arguments); }
          });

          guardianjs = guardianStubbed({
            serviceUrl: 'https://tenant.guardian.auth0.com',
            requestToken,
            issuer: {
              label: 'label',
              name: 'name'
            },
            accountLabel: 'accountLabel',
            globalTrackingId: 'globalTrackingId',
            dependencies: {
              httpClient,
              socketClient
            }
          });
        });

        it('callbacks with an error', function (done) {
          const error = new Error('jwt_error');
          jwtTokenFunc = () => { throw error; };
          guardianjs.start((err) => {
            expect(err).to.be.equal(error);
            done();
          });
        });
      });

      describe('when everything works ok', function () {
        let response;

        beforeEach(function () {
          response = {
            deviceAccount: {
              methods: ['otp'],
              availableMethods: ['otp'],
              name: 'test',
              phoneNumber: '+1234'
            },
            availableEnrollmentMethods: ['otp'],
            availableAuthenticationMethods: ['push'],
            transactionToken
          };

          socketClient.connect.yields();
          httpClient.post.yields(null, response);

          guardianjs = guardianjsb({
            serviceUrl: 'https://tenant.guardian.auth0.com',
            requestToken,
            issuer: {
              label: 'label',
              name: 'name'
            },
            accountLabel: 'accountLabel',
            globalTrackingId: 'globalTrackingId',
            dependencies: {
              httpClient,
              socketClient
            }
          });
        });

        it('calls start flow as expected', function (done) {
          guardianjs.start((err) => {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.true;

            const call = httpClient.post.getCall(0);
            expect(call.args[0]).to.equal('/api/start-flow');
            expect(call.args[1].getAuthHeader()).to.equal(`Bearer ${requestToken}`);
            expect(call.args[2]).to.eql({ state_transport: 'socket' });

            done();
          });
        });

        describe('for an user already enrolled', function () {
          beforeEach(function () {
            response = {
              deviceAccount: {
                methods: ['otp'],
                availableMethods: ['otp'],
                name: 'test',
                phoneNumber: '+1234'
              },
              availableEnrollmentMethods: ['otp'],
              availableAuthenticationMethods: ['push'],
              transactionToken
            };

            socketClient.connect.yields();
            httpClient.post.yields(null, response);

            guardianjs = guardianjsb({
              serviceUrl: 'https://tenant.guardian.auth0.com',
              requestToken,
              issuer: {
                label: 'label',
                name: 'name'
              },
              accountLabel: 'accountLabel',
              globalTrackingId: 'globalTrackingId',
              dependencies: {
                httpClient,
                socketClient
              }
            });
          });

          it('callbacks with an enrolled-transaction', function (done) {
            guardianjs.start((err, tx) => {
              expect(err).not.to.exist;

              const enrollment = tx.getEnrollments()[0];
              expect(enrollment).to.exist;

              expect(tx.isEnrolled()).to.be.true;

              expect(enrollment.getAvailableMethods())
                .to.eql(response.deviceAccount.availableMethods);
              expect(enrollment.getMethods())
                .to.eql(response.deviceAccount.methods);
              expect(enrollment.getName())
                .to.eql(response.deviceAccount.name);
              expect(enrollment.getPhoneNumber())
                .to.eql(response.deviceAccount.phoneNumber);

              expect(tx.transactionToken.getAuthHeader())
                .to.equal(`Bearer ${transactionToken}`);

              done();
            });
          });
        });

        describe('for an user not enrolled', function () {
          beforeEach(function () {
            response = {
              deviceAccount: {
                id: '1234',
                otpSecret: 'abcd1234',
                recoveryCode: '12asddasdasdasd'
              },
              availableEnrollmentMethods: ['otp'],
              availableAuthenticationMethods: ['push'],
              enrollmentTxId: '1234678',
              transactionToken
            };

            socketClient.connect.yields();
            httpClient.post.yields(null, response);

            guardianjs = guardianjsb({
              serviceUrl: 'https://tenant.guardian.auth0.com',
              requestToken,
              issuer: {
                label: 'label',
                name: 'name'
              },
              accountLabel: 'accountLabel',
              globalTrackingId: 'globalTrackingId',
              dependencies: {
                httpClient,
                socketClient
              }
            });
          });

          it('callbacks with a non enrolled transaction', function (done) {
            guardianjs.start((err, tx) => {
              expect(err).not.to.exist;

              const enrollment = tx.getEnrollments()[0];
              expect(enrollment).not.to.exist;

              expect(tx.getAvailableEnrollmentMethods()).to.eql(['otp']);
              expect(tx.getAvailableAuthenticationMethods()).to.eql(['push']);

              expect(tx.enrollmentAttempt.getEnrollmentTransactionId())
                .to.eql(response.enrollmentTxId);
              expect(tx.enrollmentAttempt.getOtpSecret())
                .to.eql(response.deviceAccount.otpSecret);
              expect(tx.enrollmentAttempt.getIssuerName())
                .to.eql('name');
              expect(tx.enrollmentAttempt.getIssuerLabel())
                .to.eql('label');
              expect(tx.enrollmentAttempt.getAccountLabel())
                .to.eql('accountLabel');
              expect(tx.enrollmentAttempt.getRecoveryCode())
                .to.eql(response.deviceAccount.recoveryCode);
              expect(tx.enrollmentAttempt.getEnrollmentId())
                .to.eql(response.deviceAccount.id);
              expect(tx.enrollmentAttempt.getBaseUri())
                .to.equal('https://tenant.guardian.auth0.com');

              expect(tx.transactionToken.getAuthHeader())
                .to.equal(`Bearer ${transactionToken}`);

              done();
            });
          });
        });
      });
    });

    describe('when transport is manual', function () {
      describe('when everything works ok', function () {
        let response;

        beforeEach(function () {
          response = {
            deviceAccount: {
              methods: ['otp'],
              availableMethods: ['otp'],
              name: 'test',
              phoneNumber: '+1234'
            },
            availableEnrollmentMethods: ['otp'],
            availableAuthenticationMethods: ['push'],
            transactionToken
          };

          socketClient.connect.yields();
          httpClient.post.yields(null, response);

          guardianjs = guardianjsb({
            serviceUrl: 'https://tenant.guardian.auth0.com',
            requestToken,
            issuer: {
              label: 'label',
              name: 'name'
            },
            accountLabel: 'accountLabel',
            globalTrackingId: 'globalTrackingId',
            dependencies: {
              httpClient
            },
            transport: 'manual'
          });
        });

        it('calls start flow as expected', function (done) {
          guardianjs.start((err) => {
            expect(err).not.to.exist;
            expect(httpClient.post.calledOnce).to.be.true;

            const call = httpClient.post.getCall(0);
            expect(call.args[0]).to.equal('/api/start-flow');
            expect(call.args[1].getAuthHeader()).to.equal(`Bearer ${requestToken}`);
            expect(call.args[2]).to.eql({ state_transport: 'polling' });

            done();
          });
        });

        it('uses nullClient', function () {
          // This is an implementation detail, but worth checking IMO
          expect(guardianjs.socketClient).to.be.an.instanceOf(nullClient);
        });

        describe('for an user already enrolled', function () {
          beforeEach(function () {
            response = {
              deviceAccount: {
                methods: ['otp'],
                availableMethods: ['otp'],
                name: 'test',
                phoneNumber: '+1234'
              },
              availableEnrollmentMethods: ['otp'],
              availableAuthenticationMethods: ['push'],
              transactionToken,
              transport: 'manual'
            };

            socketClient.connect.yields();
            httpClient.post.yields(null, response);

            guardianjs = guardianjsb({
              serviceUrl: 'https://tenant.guardian.auth0.com',
              requestToken,
              issuer: {
                label: 'label',
                name: 'name'
              },
              accountLabel: 'accountLabel',
              globalTrackingId: 'globalTrackingId',
              dependencies: {
                httpClient,
                socketClient
              },
              transport: 'manual'
            });
          });

          it('callbacks with an enrolled-transaction', function (done) {
            guardianjs.start((err, tx) => {
              expect(err).not.to.exist;

              const enrollment = tx.getEnrollments()[0];
              expect(enrollment).to.exist;

              expect(tx.isEnrolled()).to.be.true;

              expect(enrollment.getAvailableMethods())
                .to.eql(response.deviceAccount.availableMethods);
              expect(enrollment.getMethods())
                .to.eql(response.deviceAccount.methods);
              expect(enrollment.getName())
                .to.eql(response.deviceAccount.name);
              expect(enrollment.getPhoneNumber())
                .to.eql(response.deviceAccount.phoneNumber);

              expect(tx.transactionToken.getAuthHeader())
                .to.equal(`Bearer ${transactionToken}`);

              done();
            });
          });
        });

        describe('for an user not enrolled', function () {
          beforeEach(function () {
            response = {
              deviceAccount: {
                id: '1234',
                otpSecret: 'abcd1234',
                recoveryCode: '12asddasdasdasd'
              },
              availableEnrollmentMethods: ['otp'],
              availableAuthenticationMethods: ['push'],
              enrollmentTxId: '1234678',
              transactionToken,
              transport: 'manual'
            };

            socketClient.connect.yields();
            httpClient.post.yields(null, response);

            guardianjs = guardianjsb({
              serviceUrl: 'https://tenant.guardian.auth0.com',
              requestToken,
              issuer: {
                label: 'label',
                name: 'name'
              },
              accountLabel: 'accountLabel',
              globalTrackingId: 'globalTrackingId',
              dependencies: {
                httpClient,
                socketClient
              }
            });
          });

          it('callbacks with a non enrolled transaction', function (done) {
            guardianjs.start((err, tx) => {
              expect(err).not.to.exist;

              const enrollment = tx.getEnrollments()[0];
              expect(enrollment).not.to.exist;

              expect(tx.getAvailableEnrollmentMethods()).to.eql(['otp']);
              expect(tx.getAvailableAuthenticationMethods()).to.eql(['push']);

              expect(tx.enrollmentAttempt.getEnrollmentTransactionId())
                .to.eql(response.enrollmentTxId);
              expect(tx.enrollmentAttempt.getOtpSecret())
                .to.eql(response.deviceAccount.otpSecret);
              expect(tx.enrollmentAttempt.getIssuerName())
                .to.eql('name');
              expect(tx.enrollmentAttempt.getIssuerLabel())
                .to.eql('label');
              expect(tx.enrollmentAttempt.getAccountLabel())
                .to.eql('accountLabel');
              expect(tx.enrollmentAttempt.getRecoveryCode())
                .to.eql(response.deviceAccount.recoveryCode);
              expect(tx.enrollmentAttempt.getEnrollmentId())
                .to.eql(response.deviceAccount.id);
              expect(tx.enrollmentAttempt.getBaseUri())
                .to.equal('https://tenant.guardian.auth0.com');

              expect(tx.transactionToken.getAuthHeader())
                .to.equal(`Bearer ${transactionToken}`);

              done();
            });
          });
        });
      });
    });
  });

  describe('#resume', function () {
    // eslint-disable-next-line max-len
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE0NzgyMTU4OTUwMDAwMDAsInR4aWQiOiIyYTliNWI2YjQzYjFiNmIyYjkiLCJhZG1pbiI6dHJ1ZX0.E5-_n8sdEyZ1RuDUdMJr9JSJB0AuE4ODMyVGIrG8Jg8';
    // eslint-disable-next-line max-len
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjAsInR4aWQiOiIyYTliNWI2YjQzYjFiNmIyYjkiLCJhZG1pbiI6dHJ1ZX0.klPmsaVTzhDvVNUPCs0grJuWJdlc5_3B1dZfrCOqPIY';
    let serializedTransaction;

    httpClient = {
      post: sinon.stub(),
      get: sinon.stub(),
      put: sinon.stub(),
      patch: sinon.stub(),
      del: sinon.stub()
    };

    socketClient = {
      connect: sinon.stub(),
      on: sinon.stub()
    };

    const options = { dependencies: { httpClient, socketClient } };

    socketClient.connect.yields();

    beforeEach(function () {
      serializedTransaction = {
        transactionToken: token,
        enrollments: [
          {
            availableMethods: ['sms'],
            phoneNumber: '+1111111'
          }
        ],
        baseUrl: 'http://42.org',
        availableEnrollmentMethods: ['sms'],
        availableAuthenticationMethods: ['push']
      };
    });

    describe('when token is invalid', function () {
      it('callbacks with a enrolled transaction', function (done) {
        guardianjsb.resume(options, '123', (err) => {
          expect(err).to.exist;
          expect(err.message).to.equal('Invalid transaction token');
          expect(err.errorCode).to.equal('invalid_token');

          done();
        });
      });
    });

    it('callbacks with a enrolled transaction', function (done) {
      guardianjsb.resume(options, serializedTransaction, (err, tx) => {
        expect(err).not.to.exist;

        const enrollment = tx.getEnrollments()[0];
        expect(enrollment.getPhoneNumber()).to.equal('+1111111');
        expect(enrollment.getAvailableMethods()).to.eql(['sms']);

        expect(tx.getAvailableEnrollmentMethods()).to.eql(['sms']);
        expect(tx.getAvailableAuthenticationMethods()).to.eql(['push']);
        expect(serializedTransaction.enrollmentConfirmationStep).not.to.exist;
        expect(serializedTransaction.authVerificationStep).not.to.exist;

        done();
      });
    });

    describe('when transaction token is expired', function () {
      beforeEach(function () {
        serializedTransaction.transactionToken = expiredToken;
      });

      it('callbacks with credentials expired error', function (done) {
        guardianjsb.resume(options, serializedTransaction, (err) => {
          expect(err).to.exist;
          expect(err.message).to.equal('The credentials has expired.');
          expect(err.errorCode).to.equal('credentials_expired');

          done();
        });
      });
    });

    describe('when serialized transaction has enrollmentConfirmationStep', function () {
      beforeEach(function () {
        serializedTransaction.enrollmentConfirmationStep = { method: 'sms' };
      });

      describe('and when an enrollmentAttempt is not provided', function () {
        it('callbacks with an error', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err) => {
            expect(err).to.exist;
            expect(err.message).to.equal('Expected enrollment attempt to be present: ' +
            'try calling .enroll method first');
            expect(err.errorCode).to.equal('invalid_state');
            done();
          });
        });
      });

      describe('and when method is invalid', function () {
        beforeEach(function () {
          serializedTransaction.enrollmentConfirmationStep = { method: 'invalid' };
          serializedTransaction.enrollmentAttempt = {
            data: {
              enrollmentId: '1234',
              enrollmentTxId: '1234678',
              otpSecret: 'abcd1234',
              recoveryCode: '12asddasdasdasd',
              issuer: {
                label: 'label',
                name: 'name'
              },
              baseUrl: 'https://tenant.guardian.auth0.com',
              accountLabel: 'accountLabel'
            },
            active: true
          };
        });

        it('callbacks with an error', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err) => {
            expect(err).to.exist;
            expect(err.message).to.equal('Expected data.method to be one of otp,' +
            ' sms, push, recovery-code but found invalid');
            expect(err.errorCode).to.equal('unexpected_input');
            done();
          });
        });
      });

      describe('and when an enrollmentAttempt is provided', function () {
        beforeEach(function () {
          serializedTransaction.enrollmentConfirmationStep = { method: 'sms' };
          serializedTransaction.enrollmentAttempt = {
            data: {
              enrollmentId: '1234',
              enrollmentTxId: '1234678',
              otpSecret: 'abcd1234',
              recoveryCode: '12asddasdasdasd',
              issuer: {
                label: 'label',
                name: 'name'
              },
              baseUrl: 'https://tenant.guardian.auth0.com',
              accountLabel: 'accountLabel'
            },
            active: true
          };
        });

        it('returns a transaction with enrollmentConfirmationStep', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err, tx) => {
            expect(err).not.to.exist;
            expect(tx.enrollmentConfirmationStep).to.exist;
            expect(tx.enrollmentConfirmationStep.getMethod()).to.equal('sms');
            expect(tx.enrollmentConfirmationStep.transaction).to.equal(tx);
            expect(tx.enrollmentConfirmationStep.enrollmentAttempt).to.exist;
            expect(tx.enrollmentConfirmationStep.enrollmentCompleteHub).to.exist;
            done();
          });
        });
      });
    });

    describe('when serialized transaction has authVerificationStep', function () {
      beforeEach(function () {
        serializedTransaction.authVerificationStep = { method: 'sms' };
      });

      describe('and when one enrollment is provided', function () {
        it('returns a transaction with authVerificationStep', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err, tx) => {
            expect(tx.authVerificationStep).to.exist;
            expect(tx.authVerificationStep.getMethod()).to.equal('sms');
            expect(tx.authVerificationStep.transaction).to.equal(tx);
            expect(tx.authVerificationStep.loginCompleteHub).to.exist;
            expect(tx.authVerificationStep.loginRejectedHub).to.exist;
            done();
          });
        });
      });

      describe('and when an enrollment is not provided', function () {
        beforeEach(function () {
          delete serializedTransaction.enrollments;
        });

        it('callbacks with an error', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err) => {
            expect(err).to.exist;
            expect(err.message).to.equal('Expected user to be enrolled');
            expect(err.errorCode).to.equal('invalid_state');
            done();
          });
        });
      });

      describe('and when method is invalid', function () {
        beforeEach(function () {
          serializedTransaction.authVerificationStep = { method: 'invalid' };
        });

        it('callbacks with an error', function (done) {
          guardianjsb.resume(options, serializedTransaction, (err) => {
            expect(err).to.exist;
            expect(err.message).to.equal('Expected data.method to be one of otp,' +
            ' sms, push, recovery-code but found invalid');
            expect(err.errorCode).to.equal('unexpected_input');
            done();
          });
        });
      });
    });
  });
});

