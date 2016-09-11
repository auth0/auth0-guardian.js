'use strict';

const chai = require('chai');
const PNEnrollmentStrategy = require('../../../lib/enrollment/strategies/pn_enrollment_strategy');
const sinon = require('sinon');
const chaiAsPromised = require("chai-as-promised");
const errors = require('../../../lib/errors');
const EventEmitter = require('events').EventEmitter;

const expect = chai.expect;

chai.use(chaiAsPromised);

describe('enrollment/strategies/pn_enrollment_strategy', function() {
  let socket;

  beforeEach(function() {
    socket = new EventEmitter();
  });

  describe('#confirm', function() {
    it('is callable and returns a promise', function() {
      return expect(new PNEnrollmentStrategy({

        }, null, {

        }).confirm()).to.be.fulfilled;
    });
  });

  describe('#enroll', function() {
    it('is callable and returns a promise', function() {
      return expect(new PNEnrollmentStrategy({

        }, null, {

        }).confirm()).to.be.fulfilled;
    });
  });

  describe('#getUri', function() {

    it('returns the correct url', function() {
      const getBaseUri = sinon.stub().returns('https://me.guardian.com');

      const flow = new PNEnrollmentStrategy({
          enrollment: {
            id: 'AAA',
            otpSecret: '1234555'
          },
          enrollmentTxId: '1234',
          issuer: {
            name: 'mistery',
            label: 'Mistery'
          }
        }, null, {
          guardianClient: { getBaseUri }
        });

      expect(flow.getUri()).to.equal('otpauth://totp/Mistery?secret=1234555&enrollment_tx_id=1234' +
        '&issuer=mistery&id=AAA&base_url=https%3A%2F%2Fme.guardian.com&algorithm=sha1&digits=6&counter=0&period=30');
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits enrollment-complete', function() {
      it('calls the cb', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { enrollment: { name: 'My Phone 123' } };

        const strategy = new PNEnrollmentStrategy({
          enrollment: {
            id: 'AAA',
            otpSecret: '1234555'
          },
          enrollmentTxId: '1234',
          issuer: {
            name: 'mistery',
            label: 'Mistery'
          }
        }, null, {
          socket: socket
        });

        strategy.onCompletion(function(enrollmentPayload) {
          expect(enrollmentPayload).to.eql({
            factor: 'push',
            enrollment: {
              name: 'My Phone 123',
              status: 'confirmed',
              pushNotifications: { enabled: true }
            },
            transactionComplete: false,
            loginPayload: null
          });

          done();
        });

        socket.emit('enrollment-complete', payload);
      });
    });
  });
});
