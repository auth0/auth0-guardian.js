'use strict';

var object = require('./object');

/**
 * Executes the state handler for the particular event and
 * removes the listener for that event and all the other ones
 *
 * @param {EventEmitter} emitter
 * @param {object} handlers event handlers format { [eventName]: [function(payload) { }] }
 */
exports.onceAny = function onceAny(emitter, handlers) {
  return (function onceAnyBuilder() {
    var listeners = {};

    var removeAllListeners = function removeAllListeners() {
      object.forEach(listeners, function removeListener(removalWrapper, removalEventName) {
        emitter.removeListener(removalEventName, removalWrapper);
      });
    };

    object.forEach(handlers, function handlersIterator(handler, eventName) {
      var wrapper = function handlerWrapper(payload) {
        removeAllListeners();

        handler.call(null, payload);
      };

      listeners[eventName] = wrapper;

      emitter.once(eventName, wrapper);
    });

    return { cancel: removeAllListeners };
  }());
};

exports.ignoreError = function ignoreError(emitter, error) {
  var handler = function handler(err) {
    // If it is the error we are waiting for we don't need to do anything,
    // just ignore it, the other handled will also be called to handle the
    // error (if any)
    if (err === error) {
      return;
    }

    // If it is not the expected error but other, and there is nobody else
    // to handle it let's remove the handler and re-emit it causing
    // an uncaught as expected in such case
    emitter.off('error', handler);

    if (emitter.listenerCount('error') === 0) {
      emitter.emit('error', error);
    }
  };

  // If there are other handlers we don't need to do anything, the other
  // handlers will take care of the error
  if (emitter.listenerCount('error') === 0) {
    emitter.once('error', handler);
  }
};

exports.emitErrorOrCallback = function emitErrorOrCallback(err, emitter, cb) {
  if (!cb) {
    emitter.emit('error', err);
    return;
  }

  cb(err);
};
