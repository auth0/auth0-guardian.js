'use strict';

const expect = require('chai').expect;
const AuthFlow = require('../../lib/auth/auth_flow');
const ManualAuthenticatorStrategy = require('../../lib/auth/strategies/manual_authenticator_strategy');
const PNAuthenticatorStrategy = require('../../lib/auth/strategies/pn_authenticator_strategy');
const RecoveryCodeAuthenticatorStrategy = require('../../lib/auth/strategies/recovery_code_authenticator_strategy');
const SMSAuthenticatorStrategy = require('../../lib/auth/strategies/sms_authenticator_strategy');
const errors = require('../../lib/errors');

describe('auth/auth_flow', function() {
  const guardianClient = {};

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

    describe('when push credentials are available', function() {
      it('returns pushNotification', function() {
        expect(new AuthFlow({
          transactionToken: '123',
          enrollment: {
            pushCredentials: {
              token: '1222',
              service: 'APNS'
            }
          }
        }, null, {}).getDefaultFactor()).to.equal('pushNotification');
      });
    });

    describe('when no phone number and not push credentials are available', function() {
      it('returns authenticator', function() {
        expect(new AuthFlow({
          transactionToken: '123',
          enrollment: {}
        }, null, {}).getDefaultFactor()).to.equal('authenticator');
      });
    });
  });

  describe('#forFactor', function() {
    describe('for pushNotification', function() {
      describe('for manual mode', function() {
        it('returns ManualAuthenticatorStrategy', function() {
          const strategy = new AuthFlow({
              transactionToken: '123',
              enrollment: {
                pushCredentials: {
                  token: '1222',
                  service: 'APNS'
                }
              }
            }, null, {
              guardianClient
            })
            .forFactor('pushNotification', true);

          expect(strategy).to.be.an.instanceOf(ManualAuthenticatorStrategy);
          expect(strategy.data.enrollment).to.eql({
            pushCredentials: {
              token: '1222',
              service: 'APNS'
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
                pushCredentials: {
                  token: '1222',
                  service: 'APNS'
                }
              }
            }, null, {
              guardianClient
            })
            .forFactor('pushNotification');

          expect(strategy).to.be.an.instanceOf(PNAuthenticatorStrategy);
          expect(strategy.data.enrollment).to.eql({
            pushCredentials: {
              token: '1222',
              service: 'APNS'
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

    describe('for authenticator', function() {
      it('returns ManualAuthenticatorStrategy', function() {
        const strategy = new AuthFlow({
            transactionToken: '123',
            enrollment: {}
          }, null, {
            guardianClient
          })
          .forFactor('authenticator');

        expect(strategy).to.be.an.instanceOf(ManualAuthenticatorStrategy);
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
            guardianClient
          })
          .forFactor('recoveryCode');

        expect(strategy).to.be.an.instanceOf(RecoveryCodeAuthenticatorStrategy);
      });
    });
  });
});
