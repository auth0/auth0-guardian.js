const toArray = require('lodash.toarray');

module.exports = function asyncEmitBuilder(eventEmitter, event) {
  return function asyncEmit() {
    const args = [event].concat(toArray(arguments));

    return process.nextTick(() => eventEmitter.emit.apply(eventEmitter, args));
  };
};
