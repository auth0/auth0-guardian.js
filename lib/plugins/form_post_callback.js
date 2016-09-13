'use strict';

const errors = require('../errors');
const formBuilder = require('../utils/form');

/**
 * @param {form} [dependencies.form]
 * @param {func(callback)} options.before
 * @param {string} options.callbackUrl
 */
module.exports = function formPostCallbackPluginBuilder(options, dependencies) {
  const form = dependencies.form || formBuilder({ document: global.document });
  const before = options.before || ((cb) => cb());

  return function formPostCallbackPlugin(guardianjs) {

    guardianjs.events.once('login-complete', function onLoginComplete(payload) {
      before((err) => {
        if (err) {
          return guardianjs.events.emit('error', new errors.GuardianError({
            message: 'error executing before hook for post_callback_on_login plugin'
          }));
        }

        form.post(options.callbackUrl, payload);
      });
    });
  };
};
