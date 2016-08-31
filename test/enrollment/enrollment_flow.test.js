'use strict';

const expect = require('chai').expect;
const EnrollmentFlow = require('../../lib/enrollment/enrollment_flow');
const AuthenticatorEnrollmentStrategy = require('../../lib/enrollment/strategies/authenticator_enrollment_strategy');
const PNEnrollmentStrategy = require('../../lib/enrollment/strategies/pn_enrollment_strategy');
const SMSEnrollmentStrategy = require('../../lib/enrollment/strategies/sms_enrollment_strategy');
const errors = require('../../lib/errors');

describe('enrollment/enrollment_flow', function() {
  const guardianClient = {};

  describe('#getRecoveryCode', function() {
    it('returns the recovery code', function() {
      expect(new EnrollmentFlow({
        recoveryCode: '12345'
      }).getRecoveryCode()).to.equal('12345');
    });
  });

  describe('#canEnrollWithFactor', function() {
    describe('for type authenticator', function() {
      describe('when push notification factor is enabled', function() {
        it('returns true', function() {
          expect(new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: true
              }
            }
          }).canEnrollWithFactor('authenticator')).to.be.true;
        });
      });

      describe('when push notification factor is disabled', function() {
        it('returns false', function() {
          expect(new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: false
              }
            }
          }).canEnrollWithFactor('authenticator')).to.be.false;
        });
      });
    });

    describe('for type pushNotification', function() {
      describe('when push notification factor is enabled', function() {
        it('returns true', function() {
          expect(new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: true
              }
            }
          }).canEnrollWithFactor('pushNotification')).to.be.true;
        });
      });

      describe('when push notification factor is disabled', function() {
        it('returns false', function() {
          expect(new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: false
              }
            }
          }).canEnrollWithFactor('pushNotification')).to.be.false;
        });
      });
    });

    describe('for type sms', function() {
       describe('when sms factor is enabled', function() {
        it('returns true', function() {
          expect(new EnrollmentFlow({
            factors: {
              sms: {
                enabled: true
              }
            }
          }).canEnrollWithFactor('sms')).to.be.true;
        });
      });

      describe('when sms factor is disabled', function() {
        it('returns false', function() {
          expect(new EnrollmentFlow({
            factors: {
              sms: {
                enabled: false
              }
            }
          }).canEnrollWithFactor('sms')).to.be.false;
        });
      });
    });

    describe('for invalid types', function() {
      it('throws an error', function() {
        expect(() => {
          new EnrollmentFlow({
            factors: {
              sms: {
                enabled: false
              }
            }
          }).canEnrollWithFactor('invalid');
        }).to.throw(errors.FactorNotFoundError);
      });
    });
  });

  describe('#getAvailableFactors', function() {
    describe('for type pushNotification', function() {
      it('returns authenticator and push', function() {
        expect(new EnrollmentFlow({
          factors: {
            sms: {
              enabled: false
            },
            pushNotification: {
              enabled: true
            }
          }
        })
        .getAvailableFactors())
        .to.eql(['pushNotification', 'authenticator']);
      });
    });

    describe('for type sms and push', function() {
      it('returns authenticator, push and authenticator', function() {
        expect(new EnrollmentFlow({
          factors: {
            sms: {
              enabled: true
            },
            pushNotification: {
              enabled: true
            }
          }
        })
        .getAvailableFactors())
        .to.eql(['sms', 'pushNotification', 'authenticator']);
      });
    });
  });

  describe('#forFactor', function() {
    describe('for invalid type', function() {
      it('throws an error', function() {
        expect(() => {
          new EnrollmentFlow({
            factors: {
              sms: {
                enabled: true
              }
            }
          }).forFactor('invalid');
        }).to.throw(errors.FactorNotFoundError);
      });
    });

    describe('when factor is disabled', function() {
      it('throws an error', function() {
        expect(() => {
          new EnrollmentFlow({
            factors: {
              sms: {
                enabled: false
              }
            }
          }).forFactor('sms');
        }).to.throw(errors.EnrollmentNotAllowedError);
      });
    });

    describe('for sms', function() {
      it('returns sms strategy', function() {
        const flow = new EnrollmentFlow({
            factors: {
              sms: {
                enabled: true
              }
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient
          }).forFactor('sms');

        expect(flow).to.be.an.instanceOf(SMSEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          });
      });
    });

    describe('for authenticator', function() {
      it('returns authenticator strategy', function() {
        const flow = new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: true
              }
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient
          }).forFactor('authenticator');

        expect(flow).to.be.an.instanceOf(AuthenticatorEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          });
      });
    });

    describe('for push notification', function() {
      it('returns push notification strategy', function() {
        const flow = new EnrollmentFlow({
            factors: {
              pushNotification: {
                enabled: true
              }
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient
          }).forFactor('pushNotification');

        expect(flow).to.be.an.instanceOf(PNEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          });
      });
    });
  });
});
