const chai = require('chai');
const PNEnrollmentStrategy = require('../../../lib/enrollment/strategies/pn_enrollment_strategy');
const sinon = require('sinon');
const chaiAsPromised = require("chai-as-promised");
const errors = require('../../../lib/errors');

const expect = chai.expect;

chai.use(chaiAsPromised);

describe('enrollment/strategies/pn_enrollment_strategy', function() {

  describe('#confirm', function() {
    it('is callable and returns a promise', function() {
      expect(new PNEnrollmentStrategy({

        }, null, {

        }).confirm()).to.be.rejectedWith(errors.OperationNotAllowedError)
    });
  });

  describe('#enroll', function() {
    describe('if push notification is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
          name: 'Name',
          identifier: '1234'
        })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if push notification service is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
          pushCredentials: {
            token: '1234'
          },
          name: 'Name',
          identifier: '1234'
        })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if push notification token is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
          pushCredentials: {
            service: 'APNS',
          },
          name: 'Name',
          identifier: '1234'
        })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if name is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
          pushCredentials: {
            service: 'APNS',
            token: '1234'
          },
          identifier: '1234'
        })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if identifier is not provided', function() {
      it('throws an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
          transactionToken: '1234'
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
          pushCredentials: {
            service: 'APNS',
            token: '1234'
          },
          name: 'Name',
        })).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('if enroll is accepted', function() {
      it('fulfills the promise', function() {
        const patch = sinon.stub().returns(Promise.resolve());

        const flow = new PNEnrollmentStrategy({
            transactionToken: '1234',
            enrollment: {
              id: '1234'
            }
          }, null, {
            guardianClient: { patch }
          });

        return expect(flow.enroll({
            pushCredentials: {
              service: 'APNS',
              token: '1234'
            },
            name: 'Name',
            identifier: '1234'
          }))
          .to.be.fulfilled
          .then(() => {
            expect(patch.called).to.be.true;
            expect(patch.getCall(0).args[0]).to.equal('/device-accounts/1234');
            expect(patch.getCall(0).args[1]).to.equal('1234');
            expect(patch.getCall(0).args[2]).to.eql({
              pushCredentials: {
                service: 'APNS',
                token: '1234'
              },
              name: 'Name',
              identifier: '1234'
            });
          });
      });
    });

    describe('if verify is rejected', function() {
      it('fulfills the promise', function() {
        const patch = sinon.stub().returns(Promise.reject(new Error()));

        const flow = new PNEnrollmentStrategy({
            transactionToken: '1234',
            enrollment: {
              id: '1234'
            }
          }, null, {
            guardianClient: { patch }
          });

        return expect(flow.enroll({
            pushCredentials: {
              service: 'APNS',
              token: '1234'
            },
            name: 'Name',
            identifier: '1234'
          })).to.be.rejectedWith(Error);
      });
    });
  });

  describe('#getUri', function() {

    it('returns the correct url', function() {
      const getBaseUri = sinon.stub().returns('https://me.guardian.com');

      const flow = new PNEnrollmentStrategy({
          transactionToken: '1234',
          enrollment: {
            id: 'AAA',
            otpSecret: '1234555'
          },
          enrollmentTxId: '1234',
          tenant: {
            name: 'mistery',
            friendlyName: 'Mistery'
          }
        }, null, {
          guardianClient: { getBaseUri }
        });

      expect(flow.getUri()).to.equal('otpauth://totp/mistery:Mistery?secret=1234555&enrollment_tx_id=1234' +
        '&issuer=mistery&id=AAA&base_url=https%3A%2F%2Fme.guardian.com&algorithm=sha1&digits=6&counter=0&period=30');
    });
  });
});
