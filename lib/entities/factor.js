'use strict';

const object = require('../utils/object');

exports.isAnyFactorEnabled = function isAnyFactorEnabled(factors) {
  return object.some(factors, (factor) => factor.enabled);
};

/**
 * Returns all available factors
 */
exports.getAvailableFactors = function getAvailableFactors(factors) {
  return object.reduce(factors, (available, factor, name) => {
    if (factor.enabled) {
      available.push(name);
    }

    if (name === 'push') {
      available.push('otp');
    }

    return available;
  }, []);
};
