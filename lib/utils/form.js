'use strict';

/**
 * Browser ONLY
 *
 * Methods to create an manipulate HTML Forms
 */

const object = require('./object');

/**
 * @param {BrowserDocument} dependencies.document
 */
module.exports = function builder(dependencies) {
  const document = dependencies.document;

  const mod = {};

  /**
   * Post an object to a form
   *
   * @param {string} path
   * @param {object} params
   */
  mod.post = function post(path, params) {
    const method = 'post';

    const form = document.createElement('form');
    form.setAttribute('method', method);
    form.setAttribute('action', path);

    object.forEach(params, (value, key) => {
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

  return mod;
};
