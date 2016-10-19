'use strict';

var object = require('./object');

function auth0Ticket(ticket) {
  var self = object.create(auth0Ticket.prototype);
  self.ticket = ticket;

  return self;
}

auth0Ticket.prototype.getAuthHeader = function getAuthHeader() {
  return 'Ticket id="' + this.token + '"';
};

auth0Ticket.prototype.isExpired = function isExpired() {
  return false;
};

auth0Ticket.prototype.getToken = function getToken() {
  return this.ticket;
};

auth0Ticket.prototype.getDecoded = function getDecoded() {
  return {};
};

module.exports = auth0Ticket;
