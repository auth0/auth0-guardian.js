'use strict';

const expect = require('chai').expect;
const enrollmentUriHelper = require('../../lib/utils/enrollment_uri_helper');

describe('utils/enrollment_uri_helper', function () {
  describe('when all data is specified', function () {
    it('returns the correct url', function () {
      expect(enrollmentUriHelper({
        issuerLabel: 'issuer label',
        otpSecret: 'superSecret',
        enrollmentTransactionId: 'aa1 234',
        issuerName: 'issuer name',
        enrollmentId: '1234',
        baseUrl: 'https://a.guardian.auth0.com',
        algorithm: 'sha1',
        digits: 6,
        counter: 0,
        period: 30
      })).to.equal(['otpauth://totp/issuer%20label',
        '?secret=superSecret',
        '&enrollment_tx_id=aa1%20234',
        '&issuer=issuer%20name',
        '&id=1234',
        `&base_url=${encodeURIComponent('https://a.guardian.auth0.com')}`,
        '&algorithm=sha1',
        '&digits=6',
        '&counter=0',
        '&period=30'].join(''));
    });
  });

  describe('when only issuer label and otp secret is specified', function () {
    it('returns the correct url', function () {
      expect(enrollmentUriHelper({
        issuerLabel: 'issuer label',
        otpSecret: 'superSecret'
      })).to.equal('otpauth://totp/issuer%20label?secret=superSecret');
    });
  });
});
