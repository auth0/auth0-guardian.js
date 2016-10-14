'use strict';

/**
 * Browser ONLY
 *
 * Methods to create an manipulate HTML Forms
 */

const object = require('./object');

/**
 * @param {BrowserDocument} options.dependencies.document
 */
function form(options) {
  const document = options.dependencies.document;

  const self = object.create(form.prototype);

  return self;
};


/**
 * Post an object to a form
 *
 * @param {string} path
 * @param {object} params
 */
form.prototype.post = function post(path, params) {
  const method = 'post';

  const form = document.createElement('form');
  form.setAttribute('method', method);
  form.setAttribute('action', path);

  object.forEach(params, function fieldIterator(value, key) {
    const hiddenField = document.createElement('input');
    hiddenField.setAttribute('type', 'hidden');
    hiddenField.setAttribute('name', key);
    hiddenField.setAttribute('value', value);

    form.appendChild(hiddenField);
  });

  document.body.appendChild(form);

  form.submit();

  if (document.body.removeChild) {
    document.body.removeChild(form);
  }
};

module.exports = form;
