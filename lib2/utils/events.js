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
