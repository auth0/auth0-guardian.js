'use strict';

var object = require('./object');

/**
 * Executes the state handler for the particular event and
 * removes the listener for that event and all the other ones
 *
 * @param {EventEmitter} emitter
 * @param {object} handlers event handlers format { [eventName]: [function(payload) { }] }
 */
exports.onceAny = function(emitter, handlers) {
  return (function() {
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
  });
};

/**
 * A hub keeps track of an event and its listeners on a particular context and
 * is able to manage them on that context
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 */
exports.buildEventHub = function(emitter, eventName) {
  return eventListenerHub(emitter, eventName);
};

function eventListenerHub(emitter, eventName) {
  var self = object.create(eventListener.prototype);

  self.emitter = emitter;
  self.eventName = eventName;
  self.handlers = [];
  self.defaultHandler = null;

  return self;
}

eventListener.prototype.listen = function(handler) {
  this.handlers.push(handler);
  this.emitter.on(this.eventName, handler);
};

eventListener.prototype.listenOnce = function() {
  this.handlers.push(handler);
  this.emitter.once(this.eventName, handler);
};

/**
 * Default action if there are no other handlers listening on the hub
 */
eventListener.prototype.defaultHandler = function(handler) {
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

eventListener.prototype.removeAllListeners = function() {
  var self = this;

  object.forEach(self.handlers, function handlerRemoval(handler) {
    self.emitter.removeListener(self.eventName, handler);
  });

  self.handlers = [];
};
