'use strict';

const jwtDecode = require('jwt-decode');
const EventEmitter = require('events').EventEmitter;

module.exports = class JWTToken {
  constructor(token) {
    this.token = token;
    this.decoded = jwtDecode(token);
    this.events = new EventEmitter();

    if (this.decoded && this.decoded.exp) {
      const remaining = this.getRemainingTime();

      this.expirationTimeout = setTimeout(() => {
        this.events.emit('token-expired');
      }, remaining);
    }
  }

  getRemainingTime() {
    const exp = this.decoded.exp * 1000; // decoded.exp is in seconds
    const remaining = exp - Date.now();

    return remaining;
  }

  isExpired() {
    return this.getRemainingTime() <= 0;
  }

  getToken() {
    return this.token;
  }

  getDecoded() {
    return this.decoded;
  }

  once(event, cb) {
    this.events.once(event, cb);
  }

  on(event, cb) {
    this.events.once(event, cb);
  }

  removeAllListeners() {
    clearTimeout(this.expirationTimeout);

    this.events.removeAllListeners();
  }

  removeListener(event, cb) {
    this.events.removeListener(event, cb);
  }
};
