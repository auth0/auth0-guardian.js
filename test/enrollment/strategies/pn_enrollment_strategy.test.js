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
    it('is callable and returns a promise', function() {
      expect(new PNEnrollmentStrategy({

        }, null, {

        }).confirm()).to.be.rejectedWith(errors.OperationNotAllowedError)
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
