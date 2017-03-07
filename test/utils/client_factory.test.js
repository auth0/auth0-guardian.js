'use strict';

const expect = require('chai').expect;
const clientFactory = require('../../lib/utils/client_factory');
const pollingClient = require('../../lib/utils/polling_client');
const socketClient = require('../../lib/utils/socket_client');
const nullClient = require('../../lib/utils/null_client');

describe('client factory', function () {
  describe('#create', function () {
    describe('if options.dependency is defined', function () {
      it('returns the dependency', function () {
        const dependency = { hola: 'hello' };

        expect(clientFactory.create({ dependency })).to.equal(dependency);
      });
    });

    describe('if options.transport is polling', function () {
      it('returns an instance of polling client', function () {
        expect(clientFactory.create({ transport: 'polling', serviceUrl: 'http://localhost', httpClient: {} })).to.be.an.instanceOf(pollingClient);
      });
    });

    describe('if options.transport is manual', function () {
      it('returns an instance of null client', function () {
        expect(clientFactory.create({ transport: 'manual' })).to.be.an.instanceOf(nullClient);
      });
    });

    describe('if options.transport is not defined', function () {
      it('returns an instance of socket client', function () {
        expect(clientFactory.create({ serviceUrl: 'http://localhost' })).to.be.an.instanceOf(socketClient);
      });
    });
  });
});
