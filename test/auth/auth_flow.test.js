'use strict';

const expect = require('chai').expect;
const AuthFlow = require('../../lib/auth/auth_flow');
const OTPAuthenticatorStrategy = require('../../lib/auth/strategies/otp_authenticator_strategy');
const PNAuthenticatorStrategy = require('../../lib/auth/strategies/pn_authenticator_strategy');
const RecoveryCodeAuthenticatorStrategy = require('../../lib/auth/strategies/recovery_code_authenticator_strategy');
const SMSAuthenticatorStrategy = require('../../lib/auth/strategies/sms_authenticator_strategy');
const errors = require('../../lib/errors');
const sinon = require('sinon');

describe('auth/auth_flow', function() {
  const guardianClient = {};
  let socket;

  beforeEach(function() {
    socket = { on: sinon.stub(), once: sinon.stub() };
  });

  describe('#getDefaultFactor', function() {
    describe('when phone number is available', function() {
      it('returns sms', function() {
        expect(new AuthFlow({
          transactionToken: '123',
          enrollment: {
            phoneNumber: '+54 34167777'
          }
        }, null, {}).getDefaultFactor()).to.equal('sms');
      });
    });

    describe('when push are enabled', function() {
      it('returns push', function() {
        expect(new AuthFlow({
          transactionToken: '123',
          enrollment: {
            pushNotifications: {
              enabled: true
            }
          }
        }, null, {}).getDefaultFactor()).to.equal('push');
      });
    });

    describe('when no phone number and push are not available', function() {
      it('returns authenticaotptor', function() {
        expect(new AuthFlow({
          transactionToken: '123',
          enrollment: {}
        }, null, {}).getDefaultFactor()).to.equal('otp');
      });
    });
  });

  describe('#forFactor', function() {
    describe('for push', function() {
      describe('for manual mode', function() {
        it('returns OTPAuthenticatorStrategy', function() {
          const strategy = new AuthFlow({
              transactionToken: '123',
              enrollment: {
                pushNotifications: {
                  enabled: true
                }
              }
            }, null, {
              guardianClient,
              socket
            })
            .forFactor('otp');

          expect(strategy).to.be.an.instanceOf(OTPAuthenticatorStrategy);
          expect(strategy.data.enrollment).to.eql({
            pushNotifications: {
              enabled: true
            }
          });
          expect(strategy.data.transactionToken).to.equal('123');
        });
      });

      describe('for default mode', function() {
        it('returns PNAuthenticatorStrategy', function() {
          const strategy = new AuthFlow({
              transactionToken: '123',
              enrollment: {
                pushNotifications: {
                  enabled: true
                }
              }
            }, null, {
              guardianClient,
              socket
            })
            .forFactor('push');

          expect(strategy).to.be.an.instanceOf(PNAuthenticatorStrategy);
          expect(strategy.data.enrollment).to.eql({
            pushNotifications: {
              enabled: true
            }
          });
          expect(strategy.data.transactionToken).to.equal('123');
        });
      });
    });

    describe('for sms', function() {
      it('returns SMSAuthenticatorStrategy', function() {
          const strategy = new AuthFlow({
              transactionToken: '123',
              enrollment: {
                phoneNumber: '+54 122222222'
              }
            }, null, {
              guardianClient
            })
            .forFactor('sms');

          expect(strategy).to.be.an.instanceOf(SMSAuthenticatorStrategy);
          expect(strategy.data.enrollment).to.eql({ phoneNumber: '+54 122222222' });
          expect(strategy.data.transactionToken).to.equal('123');
        });
    });

    describe('for otp', function() {
      it('returns OTPAuthenticatorStrategy', function() {
        const strategy = new AuthFlow({
            transactionToken: '123',
            enrollment: {}
          }, null, {
            guardianClient,
            socket
          })
          .forFactor('otp');

        expect(strategy).to.be.an.instanceOf(OTPAuthenticatorStrategy);
        expect(strategy.data.enrollment).to.eql({});
        expect(strategy.data.transactionToken).to.equal('123');
      });
    });

    describe('for recoveryCode', function() {
      it('returns RecoveryCodeAuthenticatorStrategy', function() {
        const strategy = new AuthFlow({
            transactionToken: '123',
            enrollment: {}
          }, null, {
            guardianClient,
            socket
          })
          .forRecoveryCode();

        expect(strategy).to.be.an.instanceOf(RecoveryCodeAuthenticatorStrategy);
      });
    });
  });
});
