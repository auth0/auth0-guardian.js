'use strict';

const expect = require('chai').expect;
const guardianjsb = require('../lib');
const sinon = require('sinon');
// const EventEmitter = require('events').EventEmitter;

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
      del: sinon.stub()
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
            expect(call.args[2]).to.equal(null);

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
  });
});
