'use strict';

var path = require('path');

module.exports = {
  context: __dirname,
  entry: {
    'guardian-js': './index.js'
  },
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'auth0GuardianJS'
  }
};
