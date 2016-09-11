'use strict';

const chai = require('chai');
const SMSEnrollmentStrategy = require('../../../lib/enrollment/strategies/sms_enrollment_strategy');
const sinon = require('sinon');
const chaiAsPromised = require("chai-as-promised");
const errors = require('../../../lib/errors');
const JWTToken = require('../../../lib/utils/jwt_token');
const EventEmitter = require('events').EventEmitter;

const expect = chai.expect;

chai.use(chaiAsPromised);

describe('enrollment/strategies/sms_enrollment_strategy', function() {
  let socket;
  let transactionToken;
  let transactionTokenString;

  beforeEach(function() {
    socket = new EventEmitter();
    transactionTokenString = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiIxMTEifQ.a_7u26PXc3Iv5J6eq9vGeZiKnoYWfBYqVJdz1Gtxh0s';
    transactionToken = new JWTToken(transactionTokenString);
  });

  describe('#enroll', function() {
    describe('if phoneNumber is not provided', function() {
      it('reject with an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new SMSEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            id: '123'
          }
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({})).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('when enrollment success', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new SMSEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            id: '123'
          }
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.enroll({
            phoneNumber: '+54 93416741493'
          }))
          .to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/device-accounts/123/sms-enroll');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.eql({ phoneNumber: '+54 93416741493' });
          });
      });
    });
  });

  describe('#confirm', function() {
    describe('if otpCode is not provided', function() {
      it('rejects with an error', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new SMSEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            id: '123'
          }
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.confirm({})).to.be.rejectedWith(errors.FieldRequiredError);
      });
    });

    describe('when verification success', function() {
      it('fulfills the promise', function() {
        const post = sinon.stub().returns(Promise.resolve());

        const flow = new SMSEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            id: '123'
          }
        }, null, {
          guardianClient: { post }
        });

        return expect(flow.confirm({
            otpCode: '123456'
          })).to.be.fulfilled
          .then(() => {
            expect(post.called).to.be.true;
            expect(post.getCall(0).args[0]).to.equal('/verify-otp');
            expect(post.getCall(0).args[1]).to.equal(transactionTokenString);
            expect(post.getCall(0).args[2]).to.eql({ type: 'manual_input', code: '123456' });
          });
      });
    });
  });

  describe('#getUri', function() {
    it('exists', function() {
      const flow = new SMSEnrollmentStrategy({
          transactionToken: transactionToken,
          enrollment: {
            id: '123'
          }
        }, null, {
          guardianClient: {}
        });

      expect(flow.getUri).to.exist;
    });

    it('returns a falsy value', function() {
      const flow = new SMSEnrollmentStrategy({
        transactionToken: transactionToken,
        enrollment: {
          id: '123'
        }
      }, null, {
        guardianClient: {}
      });

      expect(flow.getUri()).not.to.exist;
    });
  });

  describe('#onCompletion', function() {
    describe('when socket emits login-complete', function() {
      it('calls the cb', function(done) {
        const post = sinon.stub().returns(Promise.resolve());
        const payload = { signature: '123' };

        const strategy = new SMSEnrollmentStrategy({
            transactionToken: transactionToken,
            enrollment: {
              id: '123'
            }
          }, null, {
            guardianClient: { post },
            socket: socket
          });

        strategy.onCompletion(function(loginPayload) {
          expect(loginPayload).to.eql({
            factor: 'sms',
            enrollment: { status: 'confirmed' },
            transactionComplete: true,
            loginPayload: payload
          });

          done();
        });

        socket.emit('login-complete', payload);
      });
    });
  });
});
