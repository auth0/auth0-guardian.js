'use strict';

const expect = require('chai').expect;
// const mockuire = require('mockuire')(module);
const sinon = require('sinon');
const pollingClient = require('../../lib/utils/polling_client');

describe('utils/polling_client', function () {
  let httpClient;
  let iPollingClient;
  let clock;

  beforeEach(function () {
    clock = sinon.useFakeTimers();

    httpClient = {
      post: sinon.stub()
    };

    iPollingClient = pollingClient(null, {
      minPollingIntervalMs: 500,
      pollingIntervalMs: 2000,
      httpClient
    });

    sinon.spy(iPollingClient.hub, 'emit');
  });

  afterEach(function () {
    iPollingClient.closeConnection();
    clock.restore();
  });

  describe('polling', function () {
    describe('when a 401 error is triggered', function () {
      const error = new Error();
      error.response = {
        statusCode: 401
      };

      beforeEach(function () {
        httpClient.post.onFirstCall().yields(null, { headers: {}, body: {} });
        httpClient.post.onSecondCall().yields(error);
      });

      it('closes the connection', function () {
        iPollingClient.once('error', () => {});
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        clock.tick(2000);
        expect(iPollingClient.isConnected()).to.be.false;
      });

      it('emits an error', function (done) {
        iPollingClient.once('error', (err) => {
          expect(error).to.equal(err);
          done();
        });

        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        clock.tick(2000);
      });
    });

    describe('when an generic error is triggered', function () {
      const error = new Error();

      beforeEach(function () {
        httpClient.post.onFirstCall().yields(null, { headers: {}, body: {} });
        httpClient.post.onSecondCall().yields(error);
      });

      it('does not closes the connection', function () {
        iPollingClient.once('error', () => {});
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        clock.tick(2000);
        expect(iPollingClient.isConnected()).to.be.true;
      });

      it('emits an error', function (done) {
        iPollingClient.once('error', (err) => {
          expect(error).to.equal(err);
          done();
        });

        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        clock.tick(2000);
      });
    });

    describe('when a 429 is triggered', function () {
      beforeEach(function () {
        const error = new Error();
        error.response = {
          statusCode: 429,
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': (Date.now() / 1000) + 400 // 400 secs
          }
        };

        httpClient.post.yields(error);
      });

      it('polls using the remaining time to reset', function () {
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        httpClient.post.reset();
        expect(httpClient.post.called).to.be.false;
        clock.tick(100000);
        expect(httpClient.post.called).to.be.false;
        clock.tick(100000);
        expect(httpClient.post.called).to.be.false;
        clock.tick(100000);
        expect(httpClient.post.called).to.be.false;
        clock.tick(100000);
        expect(httpClient.post.called).to.be.false;
        clock.tick(80000);
        expect(httpClient.post.called).to.be.true;
      });
    });

    describe('when everything goes well', function () {
      beforeEach(function () {
        for (let i = 1; i <= 10; i++) {
          httpClient.post.onCall(i - 1).yields(null, {
            body: {
              id: 'tx_123',
              state: 'pending',
              enrollment: null
            },
            headers: {
              'X-RateLimit-Limit': 10,
              'X-RateLimit-Remaining': 10 - i,
              'X-RateLimit-Reset': ((Date.now() / 1000) + 1000) - (i * 100) // 400 secs
            }
          });
        }
      });

      it('polls at an evenly distributed interval ' +
      'to consume tokens before reset + shift time', function () {
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        expect(httpClient.post.callCount).to.equal(1);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(1);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(2);

        expect(httpClient.post.callCount).to.equal(2);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(2);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(3);

        expect(httpClient.post.callCount).to.equal(3);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(3);
        clock.tick(60000);
        expect(httpClient.post.callCount).to.equal(4);
      });
    });

    describe('when polling interval to consume all remaining tokens before ' +
      'reset is less than the minimun', function () {
      beforeEach(function () {
        httpClient.post.yields(null, {
          body: {
            id: 'tx_123',
            state: 'pending',
            enrollment: null
          },
          headers: {
            'X-RateLimit-Limit': 1000,
            'X-RateLimit-Remaining': 1000,
            'X-RateLimit-Reset': (Date.now() / 1000) + 100
          }
        });
      });

      it('polls using the minimun interval', function () {
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        httpClient.post.reset();
        expect(httpClient.post.called).to.be.false;
        clock.tick(100);
        expect(httpClient.post.called).to.be.false;
        clock.tick(100);
        expect(httpClient.post.called).to.be.false;
        clock.tick(100);
        expect(httpClient.post.called).to.be.false;
        clock.tick(350);
        expect(httpClient.post.called).to.be.true;
      });
    });

    describe('when there is not any remaining token', function () {
      beforeEach(function () {
        httpClient.post.onFirstCall().yields(null, {
          body: {
            id: 'tx_123',
            state: 'pending',
            enrollment: null
          },
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 9,
            'X-RateLimit-Reset': (Date.now() / 1000) + 900
          }
        });

        httpClient.post.onSecondCall().yields(null, {
          body: {
            id: 'tx_123',
            state: 'pending',
            enrollment: null
          },
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 0,
            'X-RateLimit-Reset': (Date.now() / 1000) + 800
          }
        });

        httpClient.post.onCall(2).yields(null, {
          body: {
            id: 'tx_123',
            state: 'pending',
            enrollment: null
          },
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 1,
            'X-RateLimit-Reset': (Date.now() / 1000) + 800
          }
        });
      });

      it('polls using the interval left to reset', function () {
        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        expect(httpClient.post.callCount).to.equal(1);
        clock.tick(150000);
        expect(httpClient.post.callCount).to.equal(2);
        clock.tick(150000);
        expect(httpClient.post.callCount).to.equal(2);
        clock.tick(150000);
        expect(httpClient.post.callCount).to.equal(2);
        clock.tick(487000);
        expect(httpClient.post.callCount).to.equal(3);
      });
    });
  });

  describe('events', function () {
    describe('when state changes from not enrolled to enrolled', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: null
        },
        transitionState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          }
        },
        events: [
          {
            name: 'enrollment:confirmed',
            payload: {
              deviceAccount: {
                id: 'dev_123',
                test: 'test'
              },
              txId: 'tx_1234'
            }
          }
        ]
      });
    });

    describe('when state changes from not enrolled to accepted', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: null
        },
        transitionState: {
          id: 'tx_1234',
          state: 'accepted',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          },
          token: '123.123.1234'
        },
        events: [
          {
            name: 'enrollment:confirmed',
            payload: {
              deviceAccount: {
                id: 'dev_123',
                test: 'test'
              },
              txId: 'tx_1234'
            }
          },
          {
            name: 'login:complete',
            payload: {
              txId: 'tx_1234',
              signature: '123.123.1234'
            },
            stopPolling: false
          }
        ]
      });
    });

    describe('when state changes from not enrolled to rejected', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: null
        },
        transitionState: {
          id: 'tx_1234',
          state: 'rejected',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          }
        },
        events: [
          {
            name: 'enrollment:confirmed',
            payload: {
              deviceAccount: {
                id: 'dev_123',
                test: 'test'
              },
              txId: 'tx_1234'
            }
          },
          {
            name: 'login:rejected',
            payload: {
              txId: 'tx_1234'
            },
            stopPolling: false
          }
        ]
      });
    });

    describe('when state changes from enrolled to rejected', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          }
        },
        transitionState: {
          id: 'tx_1234',
          state: 'rejected',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          }
        },
        events: [
          {
            name: 'login:rejected',
            payload: {
              txId: 'tx_1234'
            },
            stopPolling: false
          }
        ]
      });
    });

    describe('when state changes from enrolled to accepted', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          }
        },
        transitionState: {
          id: 'tx_1234',
          state: 'accepted',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          },
          token: '123.123.1234'
        },
        events: [
          {
            name: 'login:complete',
            payload: {
              signature: '123.123.1234',
              txId: 'tx_1234'
            },
            stopPolling: true
          }
        ]
      });
    });

    describe('when state changes from not enrolled to accepted', function () {
      behavesLikeStateTransition({
        initialState: {
          id: 'tx_1234',
          state: 'pending',
          enrollment: null
        },
        transitionState: {
          id: 'tx_1234',
          state: 'accepted',
          enrollment: {
            id: 'dev_123',
            test: 'test'
          },
          token: '123.123.1234'
        },
        events: [
          {
            name: 'enrollment:confirmed',
            payload: {
              deviceAccount: {
                id: 'dev_123',
                test: 'test'
              },
              txId: 'tx_1234'
            }
          },
          {
            name: 'login:complete',
            payload: {
              signature: '123.123.1234',
              txId: 'tx_1234'
            },
            stopPolling: true
          }
        ]
      });
    });
  });

  /**
   * @param options.initialState
   * @param options.transitionState
   * @param { name, payload, stopPolling } options.events
   */
  function behavesLikeStateTransition(options) {
    const allEvents = ['enrollment:confirmed', 'login:rejected', 'login:complete'];
    const expectedEmittedEventNames = options.events.map((e) => e.name);
    const expectedNotEmittedEventNames = allEvents
      .filter((name) => expectedEmittedEventNames.indexOf(name) < 0);

    beforeEach(function () {
      httpClient.post
        .onFirstCall().yields(null, {
          body: options.initialState,
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 9,
            'X-RateLimit-Reset': (Date.now() / 1000) + 9
          }
        })
        .onSecondCall().yields(null, {
          body: options.transitionState,
          headers: {
            'X-RateLimit-Limit': 10,
            'X-RateLimit-Remaining': 8,
            'X-RateLimit-Reset': (Date.now() / 1000) + 8
          }
        });
    });

    options.events.forEach((event) => {
      it(`emits ${event.name}`, function (done) {
        iPollingClient.once(event.name, (payload) => {
          expect(payload).to.eql(event.payload);
          done();
        });

        iPollingClient.connect({
          getToken: () => '1234.1234.12aa4'
        }, (err) => {
          expect(err).not.to.exist;
        });

        clock.tick(2000);
      });

      if (event.stopPolling) {
        it('stops polling', function (done) {
          iPollingClient.once(event.name, () => {
            process.nextTick(() => {
              clock.tick(2000);
              expect(httpClient.post.args.length).to.equal(2);
              done();
            });
          });

          iPollingClient.connect({
            getToken: () => '1234.1234.12aa4'
          }, (err) => {
            expect(err).not.to.exist;
          });

          clock.tick(2000);
        });
      } else if (options.stopPolling === false) {
        it('does not stop polling', function (done) {
          iPollingClient.once(event.name, () => {
            process.nextTick(() => {
              clock.tick(2000);
              expect(httpClient.post.args.length).to.equal(3);
              done();
            });
          });

          iPollingClient.connect({
            getToken: () => '1234.1234.12aa4'
          }, (err) => {
            expect(err).not.to.exist;
          });

          clock.tick(2000);
        });
      }
    });

    it('does not emit other events', function () {
      iPollingClient.connect({
        getToken: () => '1234.1234.12aa4'
      }, (err) => {
        expect(err).not.to.exist;
      });

      clock.tick(2000);

      iPollingClient.hub.emit.args.forEach((args) => {
        const emmitedEventName = args[0];

        expect(expectedNotEmittedEventNames.indexOf(emmitedEventName) < 0).to.be.true;
      });
    });
  }
});
