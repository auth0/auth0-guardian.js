'use strict';

const expect = require('chai').expect;
const async = require('../../lib/utils/async');

describe('utils/async', function () {
  describe('#setImmediate', function () {
    describe('when setImmediate is available', function () {
      it('calls the function with the provided args', function (done) {
        async.setImmediate(function (a1, a2, a3) {
          expect(a1).to.equal('1');
          expect(a2).to.equal('2');
          expect(a3).to.equal('3');
          done();
        }, '1', '2', '3');
      });
    });

    describe('when setImmediate is not available', function () {
      it('calls the function with the provided args', function (done) {
        const old = global.setImmediate;
        async.setImmediate(function (a1, a2, a3) {
          expect(a1).to.equal('1');
          expect(a2).to.equal('2');
          expect(a3).to.equal('3');
          done();
        }, '1', '2', '3');
        global.setImmediate = old;
      });
    });
  });

  describe('#all', function () {
    describe('when there is no error', function () {
      it('calls the final callback with the results of the ' +
      'intermediate functions in the given order', function (done) {
        async.all([
          (pdone) => setTimeout(() => pdone(null, 1), 30),
          (pdone) => setTimeout(() => pdone(null, 2), 20),
          (pdone) => setTimeout(() => pdone(null, 3), 10)
        ], function (err, result) {
          expect(err).to.not.exist;
          expect(result).to.eql([1, 2, 3]);
          done();
        });
      });
    });

    describe('when there is one or more errors', function () {
      it('calls final callback with the error', function (done) {
        async.all([
          (pdone) => setTimeout(() => pdone(new Error('error1'), 1), 30),
          (pdone) => setTimeout(() => pdone(null, 2), 20),
          (pdone) => setTimeout(() => pdone(null, 3), 10)
        ], function (err, result) {
          expect(err).to.exist;
          expect(err.message).to.equal('error1');
          expect(result).not.to.exist;
          done();
        });
      });
    });
  });

  describe('#any', function () {
    describe('when there is no error', function () {
      it('calls the final callback with the ' +
      'result of the one that finished first', function (done) {
        async.any([
          (pdone) => setTimeout(() => pdone(null, 1), 30),
          (pdone) => setTimeout(() => pdone(null, 2), 20),
          (pdone) => setTimeout(() => pdone(null, 3), 10)
        ], function (err, result) {
          expect(err).to.not.exist;
          expect(result).to.equal(3);
          done();
        });
      });
    });

    describe('when there is one error after one has finished', function () {
      it('ignores the error', function (done) {
        async.any([
          (pdone) => setTimeout(() => pdone(new Error('error1'), 1), 30),
          (pdone) => setTimeout(() => pdone(null, 2), 20),
          (pdone) => setTimeout(() => pdone(null, 3), 10)
        ], function (err, result) {
          expect(err).to.not.exist;
          expect(result).to.equal(3);
          done();
        });
      });
    });

    describe('when there is one error before one has finished', function () {
      it('ignores the error', function (done) {
        async.any([
          (pdone) => setTimeout(() => pdone(new Error('error1'), 1), 1),
          (pdone) => setTimeout(() => pdone(null, 2), 200),
          (pdone) => setTimeout(() => pdone(null, 3), 100)
        ], function (err, result) {
          expect(err).to.not.exist;
          expect(result).to.equal(3);
          done();
        });
      });
    });

    describe('when all tasks ends with error', function () {
      it('calls the final callback with the errors', function (done) {
        async.any([
          (pdone) => setTimeout(() => pdone(new Error('error1'), 1), 1),
          (pdone) => setTimeout(() => pdone(new Error('error2'), 2), 20),
          (pdone) => setTimeout(() => pdone(new Error('error3'), 3), 10)
        ], function (err, result) {
          expect(err).to.exist;
          expect(err.message).to.equal('All events have failed');
          expect(err.internals[0].message).to.equal('error1');
          expect(err.internals[1].message).to.equal('error2');
          expect(err.internals[2].message).to.equal('error3');
          expect(result).not.to.exist;
          done();
        });
      });
    });
  });
});
