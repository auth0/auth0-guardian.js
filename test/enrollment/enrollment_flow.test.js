'use strict';

const expect = require('chai').expect;
const EnrollmentFlow = require('../../lib/enrollment/enrollment_flow');
const OTPEnrollmentStrategy = require('../../lib/enrollment/strategies/otp_enrollment_strategy');
const PNEnrollmentStrategy = require('../../lib/enrollment/strategies/pn_enrollment_strategy');
const SMSEnrollmentStrategy = require('../../lib/enrollment/strategies/sms_enrollment_strategy');
const errors = require('../../lib/errors');
const EventEmitter = require('events').EventEmitter;

describe.only('enrollment/enrollment_flow', function() {
  const guardianClient = {};
  let hub;
  let socket;

  beforeEach(function() {
    hub = new EventEmitter();
    socket = new EventEmitter();
  });

  describe('#getRecoveryCode', function() {
    it('returns the recovery code', function() {
      expect(new EnrollmentFlow({
        recoveryCode: '12345'
      }, null, {}).getRecoveryCode()).to.equal('12345');
    });
  });

  describe('#canEnrollWithFactor', function() {
    describe('for type otp', function() {
      describe('when push notification factor is enabled', function() {
        it('returns true', function() {
          expect(new EnrollmentFlow({
            factors: {
              push: {
                enabled: true
              }
            }
          }, null, {}).canEnrollWithFactor('otp')).to.be.true;
        });
      });

      describe('when push notification factor is disabled', function() {
        it('returns false', function() {
          expect(new EnrollmentFlow({
            factors: {
              push: {
                enabled: false
              }
            }
          }, null, {}).canEnrollWithFactor('otp')).to.be.false;
        });
      });
    });

    describe('for type push', function() {
      describe('when push notification factor is enabled', function() {
        it('returns true', function() {
          expect(new EnrollmentFlow({
            factors: {
              push: {
                enabled: true
              }
            }
          }, null, {}).canEnrollWithFactor('push')).to.be.true;
        });
      });

      describe('when push notification factor is disabled', function() {
        it('returns false', function() {
          expect(new EnrollmentFlow({
            factors: {
              push: {
                enabled: false
              }
            }
          }, null, {}).canEnrollWithFactor('push')).to.be.false;
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
          }, null, {}).canEnrollWithFactor('sms')).to.be.true;
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
          }, null, {}).canEnrollWithFactor('sms')).to.be.false;
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
          }, null, {}).canEnrollWithFactor('invalid');
        }).to.throw(errors.FactorNotFoundError);
      });
    });
  });

  describe('#getAvailableFactors', function() {
    describe('for type push', function() {
      it('returns authenticator and push', function() {
        expect(new EnrollmentFlow({
          factors: {
            sms: {
              enabled: false
            },
            push: {
              enabled: true
            }
          }
        }, null, {})
        .getAvailableFactors())
        .to.eql(['push', 'otp']);
      });
    });

    describe('for type sms and push', function() {
      it('returns authenticator, push and otp', function() {
        expect(new EnrollmentFlow({
          factors: {
            sms: {
              enabled: true
            },
            push: {
              enabled: true
            }
          }
        }, null, {})
        .getAvailableFactors())
        .to.eql(['sms', 'push', 'otp']);
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
          }, null, {}).forFactor('invalid');
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
          }, null, {}).forFactor('sms');
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
            issuer: {
              label: '123'
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient,
            hub,
            socket
          }).forFactor('sms');

        expect(flow).to.be.an.instanceOf(SMSEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            issuer: {
              label: '123'
            },
            enrollment: {
              id: '123'
            }
          });
      });
    });

    describe('for otp', function() {
      it('returns authenticator strategy', function() {
        const flow = new EnrollmentFlow({
            factors: {
              push: {
                enabled: true
              }
            },
            issuer: {
              label: '123'
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient,
            hub,
            socket
          }).forFactor('otp');

        expect(flow).to.be.an.instanceOf(OTPEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            issuer: {
              label: '123'
            },
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
              push: {
                enabled: true
              }
            },
            issuer: {
              label: '123'
            },
            enrollmentTxId: '1234',
            transactionToken: '12345',
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient,
            hub,
            socket
          }).forFactor('push');

        expect(flow).to.be.an.instanceOf(PNEnrollmentStrategy);
        expect(flow.data).to.eql({
            enrollmentTxId: '1234',
            transactionToken: '12345',
            issuer: {
              label: '123'
            },
            enrollment: {
              id: '123'
            }
          });
      });
    });
  });
});
