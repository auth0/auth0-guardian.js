/* eslint-disable no-console */

'use strict';

var https = require('https');
var pem = require('pem');
var url = require('url');
var path = require('path');
var fs = require('fs');

var mimeTypes = {
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  js: 'text/javascript',
  css: 'text/css'
};

pem.createCertificate({ days: 1, selfSigned: true }, function onCertificateReady(err, keys) {
  console.log('Got certificates');

  https.createServer({ key: keys.serviceKey, cert: keys.certificate }, function onReq(req, res) {
    var uri = url.parse(req.url).pathname;

    console.log('Got request for ' + uri);

    var filename = path.join(process.cwd(), '/dist', uri);

    fs.exists(filename, function onFileExist(exists) {
      if (!exists) {
        console.log('not exists: ' + filename);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.write('404 Not Found\n');
        res.end();
        return;
      }

      var mimeType = mimeTypes[path.extname(filename).split('.')[1]];
      res.writeHead(200, mimeType);

      var fileStream = fs.createReadStream(filename);
      fileStream.pipe(res);
    });
  }).listen(4001);
});
