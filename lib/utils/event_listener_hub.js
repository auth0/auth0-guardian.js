'use strict';

var object = require('./object');

/**
 * A hub keeps track of an event and its listeners on a particular context and
 * is able to manage them on that context
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 */
function eventListenerHub(emitter, eventName) {
  var self = object.create(eventListenerHub.prototype);

  self.emitter = emitter;
  self.eventName = eventName;
  self.handlers = [];
  self.defaultHandlerFn = null;

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
  var self = this;

  if (self.defaultHandlerFn) {
    return;
  }

  self.defaultHandlerFn = handler;

  this.emitter.on(this.eventName, function defaultListener(payload) {
    if (!self.defaultHandlerFn) {
      return;
    }

    if (self.handlers.length === 0) {
      self.defaultHandlerFn(payload);
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

module.exports = eventListenerHub;
