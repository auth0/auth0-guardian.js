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

      var listener = {};
      listener[eventName] = wrapper;

      emitter.once(eventName, wrapper);
    });

    return { cancel: removeAllListeners };
  }());
};

/**
 * A hub keeps track of an event and its listeners on a particular context and
 * is able to manage them on that context
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 */
exports.buildEventHub = function buildEventHub(emitter, eventName) {
  return eventListenerHub(emitter, eventName);
};

function eventListenerHub(emitter, eventName) {
  var self = object.create(eventListenerHub.prototype);

  self.emitter = emitter;
  self.eventName = eventName;
  self.handlers = [];
  self.defaultHandler = null;

  return self;
}

eventListenerHub.prototype.listen = function listen(handler) {
  this.handlers.push(handler);
  this.emitter.on(this.eventName, handler);
};

eventListenerHub.prototype.listenOnce = function listenOnce(handler) {
  this.handlers.push(handler);
  this.emitter.once(this.eventName, handler);
};

/**
 * Default action if there are no other handlers listening on the hub
 */
eventListenerHub.prototype.defaultHandler = function defaultHandler(handler) {
  self.defaultHandler = handler;

  if (self.defaultHandler) {
    return;
  }

  self.listen(function defaultListener(payload) {
    if (!self.defaultHandler) {
      return;
    }

    if (self.handlers.length === 0) {
      self.defaultHandler(payload);
    }
  });
};

eventListenerHub.prototype.removeAllListeners = function removeAllListeners() {
  var self = this;

  object.forEach(self.handlers, function handlerRemoval(handler) {
    self.emitter.removeListener(self.eventName, handler);
  });

  self.handlers = [];
};
