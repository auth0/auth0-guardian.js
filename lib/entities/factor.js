'use strict';

const some = require('lodash.some');
const reduce = require('lodash.reduce');

exports.isAnyFactorEnabled = function isAnyFactorEnabled(factors) {
  return some(factors, (factor) => factor.enabled);
};

/**
 * Returns all available factors
 */
exports.getAvailableFactors = function getAvailableFactors(factors) {
  return reduce(factors, (available, factor, name) => {
    if (factor.enabled) {
      available.push(name);
    }

    if (name === 'push') {
      available.push('otp');
    }

    return available;
  }, []);
};
