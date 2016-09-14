module.exports = {
  context: __dirname,
  entry: './index.js',
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js',
    libraryTarget: 'umd',
    library: 'Auth0GuardianJS'
  }
};
