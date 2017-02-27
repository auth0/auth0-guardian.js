var polling = require('./polling_client');
var socketio = require('./socket_client');

exports.create = function create(options) {
  var serviceUrl = options.serviceUrl;
  var transport = options.transport;
  var httpClient = options.httpClient;
  var dependency = options.dependency;

  if (dependency) {
    return dependency;
  }

  if (transport === 'polling') {
    return polling(serviceUrl, { httpClient: httpClient });
  }

  // default socket
  return socketio(serviceUrl);
};
