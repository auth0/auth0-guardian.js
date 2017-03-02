'use strict';

const expect = require('chai').expect;
const nullClientBuilder = require('../../lib/utils/null_client');

describe('utils/null_client', function () {
  let nullClient;

  beforeEach(function () {
    nullClient = nullClientBuilder();
  });

  it('has method #on', function () {
    expect(nullClient).to.have.respondsTo('on');
  });

  it('has method #once', function () {
    expect(nullClient).to.have.respondsTo('once');
  });

  it('has method #removeAllListeners', function () {
    expect(nullClient).to.have.respondsTo('removeAllListeners');
  });

  describe('#connect', function () {
    it('callbacks immediatelly', function (done) {
      nullClient.connect('abc', done);
    });
  });
});
