/*
  eslint-disable no-console
*/

var nodePath = require('path');

var attributeName = process.argv[2] || 'name';
var rootDir = nodePath.resolve(__dirname, '../..');
var inputPath = process.argv[3] || 'package.json';
var resolvedPath = nodePath.resolve(rootDir, inputPath);
if (resolvedPath !== rootDir && resolvedPath.indexOf(rootDir + nodePath.sep) !== 0) {
  throw new Error('Invalid path: path traversal outside of project root is not allowed');
}
var attributes = require(resolvedPath);
var value = attributes[attributeName];
if (value !== undefined) {
  console.log(value);
}
