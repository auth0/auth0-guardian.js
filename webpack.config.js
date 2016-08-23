const path = require('path');

module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.js',
    libraryTarget: 'umd',
    library: 'Auth0GuardianJS'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        loader: 'babel',
        query: {
          presets: ['es2015']
        }
      }
    ]
  }
};
