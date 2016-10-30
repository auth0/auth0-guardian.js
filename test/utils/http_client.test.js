'use strict';

const expect = require('chai').expect;
const mockuire = require('mockuire')(module);
const superagentMock = require('../support/superagent_mock');
const sinon = require('sinon');

describe('utils/http_client', function () {
  describe('when globalTrackingId is included', function () {
    examples('post', { data: '1234' }, '12345678');
    examples('patch', { data: '1234' }, '12345678');
    examples('put', { data: '1234' }, '12345678');
    examples('del', { data: '1234' }, '12345678');
    examples('get', null, '12345678');
  });

  describe('when globalTrackingId is not included', function () {
    examples('post', { data: '1234' });
    examples('patch', { data: '1234' });
    examples('put', { data: '1234' });
    examples('del', { data: '1234' });
    examples('get', null);
  });

  function examples(method, data, globalTrackingId) {
    describe(`#${method}`, function () {
      describe('when globalTrackingId is present', function () {
        let httpClient;
        let superagent;
        let credentials;

        const superagentMethods = {
          get: 'get',
          del: 'delete',
          put: 'put',
          patch: 'patch',
          post: 'post'
        };

        beforeEach(function () {
          superagent = superagentMock();
          credentials = {
            getAuthHeader: sinon.stub().returns('Bearer TOKEN')
          };

          const httpClientBuilder = mockuire('../../lib/utils/http_client', { superagent });

          httpClient = httpClientBuilder('https://tenant.something.com', globalTrackingId);
        });

        it('makes a request including the global tracking id', function (done) {
          const args = ['/api/a', credentials];

          if (data) {
            args.push(data);
          }

          args.push(function () {
            const superagentMethod = superagentMethods[method];

            expect(superagent[superagentMethod].calledOnce).to.be.true;
            expect(superagent[superagentMethod].getCall(0).args[0])
              .to.equal('https://tenant.something.com/api/a');

            const headers = collectRequestHeaders(superagent, superagentMethod);

            expect(headers.authorization).to.equal('Bearer TOKEN');
            expect(headers.accept).to.equal('application/json');

            if (globalTrackingId) {
              expect(headers['x-global-tracking-id']).to.equal(globalTrackingId);
            } else {
              expect(headers['x-global-tracking-id']).not.to.exist;
            }

            expect(superagent[superagentMethod].send.calledOnce).to.be.true;
            if (data) {
              expect(superagent[superagentMethod].send.getCall(0).args[0]).to.eql(data);
            }

            expect(superagent[superagentMethod].end.calledOnce).to.be.true;

            done();
          });

          httpClient[method].apply(httpClient, args);
        });
      });
    });
  }

  function collectRequestHeaders(superagent, method) {
    const calls = superagent[method].set.args;
    const headers = calls.reduce(function (result, callArgs) {
      // eslint-disable-next-line no-param-reassign
      result[callArgs[0].toString().toLowerCase()] = callArgs[1];
      return result;
    }, {});

    return headers;
  }
});

