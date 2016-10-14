'use strict';

/**
 * Browser ONLY
 *
 * Methods to create an manipulate HTML Forms
 */

var object = require('./object');

/**
 * @param {BrowserDocument} options.dependencies.document
 */
function form(options) {
  var document = options.dependencies.document;

  var self = object.create(form.prototype);
  self.document = document;

  return self;
}


/**
 * Post an object to a form
 *
 * @param {string} path
 * @param {object} params
 */
form.prototype.post = function post(path, params) {
  var method = 'post';

  var document = this.document;
  var formElement = document.createElement('form');
  formElement.setAttribute('method', method);
  formElement.setAttribute('action', path);

  object.forEach(params, function fieldIterator(value, key) {
    var hiddenField = document.createElement('input');
    hiddenField.setAttribute('type', 'hidden');
    hiddenField.setAttribute('name', key);
    hiddenField.setAttribute('value', value);

    formElement.appendChild(hiddenField);
  });

  document.body.appendChild(formElement);

  formElement.submit();

  if (document.body.removeChild) {
    document.body.removeChild(formElement);
  }
};

module.exports = form;
