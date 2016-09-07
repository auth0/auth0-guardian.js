'use strict';

const jwtDecode = require('jwt-decode');
const EventEmitter = require('events').EventEmitter;

module.exports = class JWTToken {
  constructor(token) {
    this.token = token;
    this.decoded = new jwtDecode(token);
    this.events = new EventEmitter();

    if (this.decoded && this.decoded.exp) {
      const exp = this.decoded.exp * 1000;
      const remaining = exp - Date.now();

      this.expirationTimeout = setTimeout(() => {
        this.events.emit('token-expired');
      }, remaining);
    }
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
}
