'use strict';

const expect = require('chai').expect;
const GuardianJS = require('..');
const errors = require('../lib/errors');
const Transaction = require('../lib/transaction');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const EventEmitter = require('events').EventEmitter;

describe('Guardian.js', function() {
  const getBaseUri = sinon.stub().returns('http://myauth0.com');

  let guardianSocket;
  let transactionTokenString;
  let requestTokenString;
  let almostExpiredToken;

  beforeEach(function() {
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    requestTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    almostExpiredToken = jwt.sign({}, '123', { expiresIn: '1s' });

    guardianSocket = {
      open: sinon.stub(),
      on: sinon.stub(),
      once: sinon.stub(),
      removeListener: sinon.stub(),
      removeAllListeners: sinon.stub()
    };
  });

  describe('events', function() {
    describe('when request token expires', function() {
       it('emits timeout event with request token expired error', function(done) {
          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: almostExpiredToken,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          });

          guardianJS.events.once('timeout', (err) => {
            expect(err).to.be.an.instanceOf(errors.RequestTokenExpired);
            done();
          });
       });
    });

    describe('when transaction token expires', function() {
       it('emits timeout event with transaction token expired error', function(done) {
          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: almostExpiredToken,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              post: sinon.stub().returns(Promise.resolve({
                transactionToken: almostExpiredToken,
                featureSwitches: {
                  mfaApp: { enroll: true },
                  mfaSms: { enroll: true }
                },
                deviceAccount: {}
              })),
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          });

          guardianJS.start();

          guardianJS.events.once('timeout', (err) => {
            expect(err).to.be.an.instanceOf(errors.TransactionTokenExpired);
            done();
          });
       });
    });

    describe('when socket error is emitted', function() {
       it('emits timeout event with request token expired error', function(done) {
          const guardianSocket = new EventEmitter();
          guardianSocket.open = sinon.stub();

          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: almostExpiredToken,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              post: sinon.stub().returns(Promise.resolve({
                transactionToken: almostExpiredToken,
                featureSwitches: {
                  mfaApp: { enroll: true },
                  mfaSms: { enroll: true }
                },
                deviceAccount: {}
              })),
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          })

          guardianJS.start().then(() => {
            guardianJS.events.once('error', (err) => {
              expect(err).to.be.an.instanceOf(Error);
              done();
            });

            guardianSocket.emit('error', new Error());
          });
       });
    });

    describe('when socket enrollment-complete is emitted', function() {
        let guardianJS;
        let guardianSocket;

        beforeEach(function() {
          guardianSocket = new EventEmitter();
          guardianSocket.open = sinon.stub();

          guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: requestTokenString,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              post: sinon.stub().returns(Promise.resolve({
                transactionToken: transactionTokenString,
                featureSwitches: {
                  mfaApp: { enroll: true },
                  mfaSms: { enroll: true }
                },
                deviceAccount: {}
              })),
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          })

          return guardianJS.start();
       });

       it('emits login-rejected', function(done) {
          guardianJS.events.once('login-rejected', (payload) => {
            expect(payload).to.eql({
              factor: 'push',
              recovery: false,
              accepted: false,
              loginPayload: null
            });

            done();
          });

          guardianSocket.emit('login-rejected');
       });
    });

    describe('when socket login-rejected is emitted', function() {
        let guardianJS;
        let guardianSocket;

        beforeEach(function() {
          guardianSocket = new EventEmitter();
          guardianSocket.open = sinon.stub();

          guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: almostExpiredToken,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              post: sinon.stub().returns(Promise.resolve({
                transactionToken: transactionTokenString,
                featureSwitches: {
                  mfaApp: { enroll: true },
                  mfaSms: { enroll: true }
                },
                deviceAccount: {}
              })),
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          })

          return guardianJS.start()
            .then(() => sinon.stub(guardianJS.transaction, 'markEnrolled'));
       });

       afterEach(function() {
         guardianJS.transaction.markEnrolled.restore();
       });

       it('emits enrollment-complete', function(done) {
          guardianJS.events.once('enrollment-complete', (enrollmentComplete) => {
            const enrollmentPayload = {
              factor: 'push',
              transactionComplete: false,
              enrollment: {
                status: 'confirmed',
                pushNotifications: { enabled: true },
                name: 'Name'
              }
            };

            expect(enrollmentComplete).to.eql(enrollmentPayload);
            expect(guardianJS.transaction.markEnrolled.called).to.be.true;
            expect(guardianJS.transaction.markEnrolled.getCall(0).args[0])
              .to.eql(enrollmentPayload);

            done();
          });

          guardianSocket.emit('enrollment-complete', {
            enrollment: { name: 'Name' }
          });
       });
    });

    describe('when socket login-complete is emitted', function() {
      let enrollmentCompleteEventEmitted = false;
      let loginCompleteEventPayload;
      let guardianSocket;
      let transaction;
      let guardianJS;

      describe('when transaction was enrolled', function() {
        beforeEach(function() {
          guardianSocket = new EventEmitter();
          guardianSocket.open = sinon.stub();

          guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: almostExpiredToken,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: {
              post: sinon.stub().returns(Promise.resolve({
                transactionToken: transactionTokenString,
                featureSwitches: {
                  mfaApp: { enroll: true },
                  mfaSms: { enroll: true }
                },
                deviceAccount: {}
              })),
              getBaseUri: sinon.stub().returns('http://www.awesome.com')
            },
            guardianSocket
          });

          return guardianJS.start()
            .then((iTransaction) => {
              transaction = iTransaction;

              sinon.stub(guardianJS.transaction, 'markEnrolled');
              sinon.stub(guardianJS.transaction, 'getCurrentFactor').returns('otp');
              sinon.stub(guardianJS.transaction, 'isEnrolled').returns(true);

              guardianJS.events.once('enrollment-complete', (enrollmentComplete) => {
                enrollmentCompleteEventEmitted = true;
              });

              guardianJS.events.once('login-complete', (iLoginCompleteEventPayload) => {
                loginCompleteEventPayload = iLoginCompleteEventPayload;
              });

              guardianSocket.emit('login-complete', {
                signature: '123.123.123'
              });

              return null;
            });
        });

        it('does not emit enrollment-complete', function(done) {
          setTimeout(() => {
            expect(enrollmentCompleteEventEmitted).to.be.false;
            expect(transaction.markEnrolled.called).to.be.false;
            done();
          }, 1000);
        });

        it('emits login-complete', function(done) {
          setTimeout(() => {
            expect(loginCompleteEventPayload).to.exist;
            expect(transaction.markEnrolled.called).to.be.false;
            expect(loginCompleteEventPayload).to.eql({
              factor: 'otp',
              wasEnrollment: false,
              recovery: false,
              accepted: true,
              loginPayload: {
                signature: '123.123.123'
              }
            });
            done();
          }, 1000);
        });
      });

      describe('when transaction is not enrolled', function() {
        describe('when current factor for transaction is push', function() {
          beforeEach(function() {
            guardianSocket = new EventEmitter();
            guardianSocket.open = sinon.stub();

            guardianJS = new GuardianJS({
              serviceDomain: 'awesome.guardian.auth0.com',
              requestToken: almostExpiredToken,
              issuer: {
                name: 'awesome',
                label: 'Awesome',
              },
            }, null, {
              guardianClient: {
                post: sinon.stub().returns(Promise.resolve({
                  transactionToken: transactionTokenString,
                  featureSwitches: {
                    mfaApp: { enroll: true },
                    mfaSms: { enroll: true }
                  },
                  deviceAccount: {}
                })),
                getBaseUri: sinon.stub().returns('http://www.awesome.com')
              },
              guardianSocket
            });

            return guardianJS.start()
              .then((iTransaction) => {
                transaction = iTransaction;

                sinon.stub(guardianJS.transaction, 'markEnrolled');
                sinon.stub(guardianJS.transaction, 'getCurrentFactor').returns('push');
                sinon.stub(guardianJS.transaction, 'isEnrolled').returns(false);

                guardianJS.events.once('enrollment-complete', (enrollmentComplete) => {
                  enrollmentCompleteEventEmitted = true;
                });

                guardianJS.events.once('login-complete', (iLoginCompleteEventPayload) => {
                  loginCompleteEventPayload = iLoginCompleteEventPayload;
                });

                guardianSocket.emit('login-complete', {
                  signature: '123.123.123'
                });

                return null;
              });
          });

          it('does not emit enrollment-complete', function(done) {
            setTimeout(() => {
              expect(enrollmentCompleteEventEmitted).to.be.false;
              expect(transaction.markEnrolled.called).to.be.false;
              done();
            }, 1000);
          });

          it('emits login-complete', function(done) {
            setTimeout(() => {
              expect(loginCompleteEventPayload).to.exist;
              expect(transaction.markEnrolled.called).to.be.false;
              expect(loginCompleteEventPayload).to.eql({
                factor: 'push',
                wasEnrollment: true,
                recovery: false,
                accepted: true,
                loginPayload: {
                  signature: '123.123.123'
                }
              });
              done();
            }, 1000);
          });
        });

        describe('when current factor for transaction is not push', function() {
          beforeEach(function() {
            guardianSocket = new EventEmitter();
            guardianSocket.open = sinon.stub();

            guardianJS = new GuardianJS({
              serviceDomain: 'awesome.guardian.auth0.com',
              requestToken: almostExpiredToken,
              issuer: {
                name: 'awesome',
                label: 'Awesome',
              },
            }, null, {
              guardianClient: {
                post: sinon.stub().returns(Promise.resolve({
                  transactionToken: transactionTokenString,
                  featureSwitches: {
                    mfaApp: { enroll: true },
                    mfaSms: { enroll: true }
                  },
                  deviceAccount: {}
                })),
                getBaseUri: sinon.stub().returns('http://www.awesome.com')
              },
              guardianSocket
            });

            return guardianJS.start()
              .then(() => {
                sinon.stub(guardianJS.transaction, 'markEnrolled');
                sinon.stub(guardianJS.transaction, 'getCurrentFactor').returns('otp');
                sinon.stub(guardianJS.transaction, 'isEnrolled').returns(false);

                return null;
              });
          });

          afterEach(function() {
            if (!guardianJS.transaction) { return; }

            guardianJS.transaction.markEnrolled.restore();
            guardianJS.transaction.getCurrentFactor.restore();
            guardianJS.transaction.isEnrolled.restore();
          });

          it('emits enrollment-complete', function(done) {
            guardianJS.events.once('enrollment-complete', (enrollmentComplete) => {
              const enrollmentPayload = {
                factor: 'otp',
                transactionComplete: true,
                enrollment: {
                  status: 'confirmed'
                }
              };

              expect(enrollmentComplete).to.eql(enrollmentPayload);
              expect(guardianJS.transaction.markEnrolled.called).to.be.true;
              expect(guardianJS.transaction.markEnrolled.getCall(0).args[0])
                .to.eql(enrollmentPayload);

              done();
            });

            guardianSocket.emit('login-complete', {
              signature: '123.123.123'
            });
          });
        });
      });
    });
  });

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
            transactionToken: transactionTokenString,
            enrollmentTxId: 'aaa',
            featureSwitches: {
              mfaSms: { enroll: false },
              mfaApp: { enroll: false },
            },
          }));

          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: requestTokenString,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: { post, getBaseUri },
            guardianSocket
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
            transactionToken: transactionTokenString,
            enrollmentTxId: 'aaa',
            featureSwitches: {
              mfaSms: { enroll: false },
              mfaApp: { enroll: true },
            },
          }));

          const guardianJS = new GuardianJS({
            serviceDomain: 'awesome.guardian.auth0.com',
            requestToken: requestTokenString,
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
          }, null, {
            guardianClient: { post, getBaseUri },
            guardianSocket
          });

          return expect(guardianJS.start()).to.be.fulfilled.then(function(tx) {
            expect(tx).to.be.instanceOf(Transaction);
            expect(tx.data.transactionToken.getToken()).to.equal(transactionTokenString);

            delete tx.data.transactionToken;

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
        const listenTo = sinon.stub();
        const post = sinon.stub().returns(Promise.resolve({
          deviceAccount: {
            status: 'confirmed',
          },
          transactionToken: transactionTokenString,
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
          guardianClient: { post, getBaseUri },
          guardianSocket
        });

        return expect(guardianJS.start()).to.be.fulfilled.then(function(tx) {
          expect(tx).to.be.instanceOf(Transaction);
          expect(tx.data.transactionToken.getToken()).to.equal(transactionTokenString);

          delete tx.data.transactionToken;

          expect(tx.data).to.eql({
            enrollment: {
              status: 'confirmed',
            },
            issuer: {
              name: 'awesome',
              label: 'Awesome',
            },
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
});
