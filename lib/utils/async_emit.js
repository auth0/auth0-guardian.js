'use strict';

const object = require('./object');

module.exports = function asyncEmitBuilder(eventEmitter, event) {
  return function asyncEmit() {
    const args = [event].concat(object.toArray(arguments));

    return process.nextTick(() => eventEmitter.emit.apply(eventEmitter, args));
  };
};
