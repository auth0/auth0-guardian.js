'use strict';

const errors = require('../errors');
const formBuilder = require('../utils/form');

/**
 * @param {form} [dependencies.form]
 * @param {func(callback)} options.before
 * @param {func(callback)} options.trigger
 * @param {string} options.callbackUrl
 */
module.exports = function formPostCallbackPluginBuilder(options, dependencies) {
  dependencies = dependencies || {};
  const form = dependencies.form || formBuilder({ document: global.document });
  const before = options.before || ((cb) => cb());

  return function formPostCallbackPlugin(guardianjs) {
    let loginPayload;
    let triggered;

    // This is meant to be an abstraction for event sorting issue:
    // if you trigger the `formPostCallback` but the payload is not yet available
    // we will wait for it to be available and automatically trigger
    // the post at that point
    guardianjs.plugins.formPostCallback = function() {
      triggered = true;

      if (loginPayload) {
        form.post(options.callbackUrl, loginPayload);
      }
    };

    guardianjs.events.once('login-complete', function onLoginComplete(payload) {
      before((err) => {
        if (err) {
          return guardianjs.events.emit('error', new errors.GuardianError({
            message: 'error executing before hook for post_callback_on_login plugin'
          }));
        }

        loginPayload = payload.loginPayload;

        if (triggered || options.trigger) {
          guardianjs.plugins.formPostCallback();
        }
      });
    });
  };
};
