'use strict';

var path = require('path');
var webpack = require('webpack');

module.exports = {
  context: __dirname,
  entry: {
    'guardian-js.min': './index.js',
    'guardian-js': './index.js'
  },
  devtool: 'source-map',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'auth0GuardianJS'
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/,
      minimize: true
    })
  ]
};
