'use strict';

module.exports = class NullSocket {
  constructor(/* options */) {}
  open() { return this; }
  close() { return this; }
  addListener(/* kind, event, cb */) { return this; }
  on(/* event, cb */) {}
  once(/* event, cb */) {}
  removeAllListeners() {}
  removeListener(/* event, cb */) {}
};
