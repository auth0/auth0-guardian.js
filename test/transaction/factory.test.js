'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const EventEmitter = require('events').EventEmitter;
const transactionFactory = require('../../lib/transaction/factory');
const jwtToken = require('../../lib/utils/jwt_token');
const errors = require('../../lib/errors');

// eslint-disable-next-line
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjI5NTY0MzE2MjksInR4aWQiOiJ0eF8xMjM0NSIsImFkbWluIjp0cnVlfQ.KYkrYwJJg-QuG1IVtCs7q7y-532t50xk3f8jIXcmsJc';

describe('transaction/factory phone otp length (factor_settings)', function () {
  let httpClient;
  let options;

  beforeEach(function () {
    httpClient = {
      post: sinon.stub().yields(null, {}),
      get: sinon.stub(),
      getBaseUrl: sinon.stub().returns('https://tenant.guardian.auth0.com')
    };
    options = { httpClient, transactionEventsReceiver: new EventEmitter() };
  });

  // Builds the camelCased start-flow payload as the httpClient delivers it,
  // for an already-enrolled (authentication) transaction.
  function buildTxLegacyData(extra) {
    return Object.assign({
      transactionToken: token,
      availableEnrollmentMethods: ['sms'],
      availableAuthenticationMethods: ['sms'],
      deviceAccount: {
        methods: ['sms'],
        availableMethods: ['sms'],
        availableAuthenticatorTypes: ['sms'],
        name: 'device',
        phoneNumber: '+1111111'
      }
    }, extra);
  }

  // The factory's fromStartFlow takes { transactionToken, txLegacyData, ... }.
  function buildStartFlow(txLegacyData) {
    return transactionFactory.fromStartFlow({
      transactionToken: jwtToken(token),
      txLegacyData: txLegacyData,
      issuer: { label: 'tenant', name: 'tenant' },
      serviceUrl: 'https://tenant.guardian.auth0.com',
      accountLabel: 'user@example.com'
    }, options);
  }

  describe('when factor_settings.phone.otp_length is present (camelCased to factorSettings.phone.otpLength)', function () {
    it('threads the length into the SMS auth strategy so it validates that digit count', function (done) {
      const tx = buildStartFlow(buildTxLegacyData({
        factorSettings: { phone: { otpLength: 7 } }
      }));

      // A 7-digit code must be accepted (posted to verify-otp), a 6-digit one rejected.
      tx.authStrategies.sms.verify({ otpCode: '123456' }, function (sixErr) {
        expect(sixErr).to.be.an.instanceof(errors.OTPValidationError);

        tx.authStrategies.sms.verify({ otpCode: '1234567' }, function (sevenErr) {
          expect(sevenErr).to.equal(null);
          sinon.assert.calledWithMatch(httpClient.post, 'api/verify-otp');
          done();
        });
      });
    });
  });

  describe('when factor_settings is absent (older mfa-api / flag off)', function () {
    it('falls back to the default length of 6', function (done) {
      const tx = buildStartFlow(buildTxLegacyData());

      tx.authStrategies.sms.verify({ otpCode: '1234567' }, function (sevenErr) {
        expect(sevenErr).to.be.an.instanceof(errors.OTPValidationError);

        tx.authStrategies.sms.verify({ otpCode: '123456' }, function (sixErr) {
          expect(sixErr).to.equal(null);
          done();
        });
      });
    });
  });

  describe('serialize / fromTransactionState round-trip', function () {
    it('preserves phoneOtpLength so a resumed transaction validates the same length', function (done) {
      const tx = buildStartFlow(buildTxLegacyData({
        factorSettings: { phone: { otpLength: 7 } }
      }));

      const state = tx.serialize();
      expect(state.phoneOtpLength).to.equal(7);

      const resumed = transactionFactory.fromTransactionState(state, options);
      resumed.authStrategies.sms.verify({ otpCode: '123456' }, function (sixErr) {
        expect(sixErr).to.be.an.instanceof(errors.OTPValidationError);
        done();
      });
    });
  });
});
