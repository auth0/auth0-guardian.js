'use strict';

var object = require('./object');
var jwtDecode = require('jwt-decode');
var EventEmitter = require('events').EventEmitter;

function jwtToken(token) {
  var self = object.create(jwtToken.prototype);
  EventEmitter.apply(self);

  self.token = token;
  self.decoded = jwtDecode(token);

  if (self.decoded && self.decoded.exp) {
    var remaining = self.getRemainingTime();

    self.expirationTimeout = setTimeout(function onTokenExpired() {
      self.emit('token-expired');
    }, remaining);
  }

  return self;
}

jwtToken.prototype = object.create(EventEmitter.prototype);

jwtToken.prototype.getRemainingTime = function getRemainingTime() {
  var exp = this.decoded.exp * 1000; // decoded.exp is in seconds
  var remaining = exp - Date.now();

  return remaining;
};

jwtToken.prototype.getAuthHeader = function getAuthHeader() {
  return 'Bearer ' + this.token;
};

jwtToken.prototype.isExpired = function isExpired() {
  return this.getRemainingTime() <= 0;
};

jwtToken.prototype.getToken = function getToken() {
  return this.token;
};

jwtToken.prototype.getDecoded = function getDecoded() {
  return this.decoded;
};

module.exports = jwtToken;
