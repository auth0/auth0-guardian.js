var polling = require('./polling_client');
var nullClient = require('./null_client');

exports.create = function create(options) {
  var serviceUrl = options.serviceUrl;
  var transport = options.transport;
  var httpClient = options.httpClient;
  var dependency = options.dependency;

  if (dependency) {
    return dependency;
  }

  if (transport === 'manual') {
    return nullClient();
  }

  return polling(serviceUrl, { httpClient: httpClient });
};
