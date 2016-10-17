'use strict';

var path = require('path');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.js',
    libraryTarget: 'umd',
    library: 'auth0GuardianJS'
  }
};
