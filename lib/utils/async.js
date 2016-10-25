'use strict';

var object = require('./object');

/**
 * Behaves like standard setImmediate if possible, otherwise fallbaks to
 * setTimeout(() => fn(args), 0)
 *
 * @param {function} fn function to call
 * @param {any} ...args args to call function
 */
exports.setImmediate = function setImmediatePF(fn) {
  var args = object.toArray(arguments).slice(1);

  if (typeof setImmediate === 'function') {
    setImmediate.apply(null, [fn].concat(args));
    return;
  }

  setTimeout(function setImmediateTimeout() {
    fn.apply(null, args);
  }, 0);
};

/**
 * Executes a set of tasks in parallel, callbacks immediatelly if there is an error,
 * returns all callbacks with an array of results once all have finished otherwise
 *
 * @param {array.<function(done)>} tasks tasks to execute
 * @param {function} callback final callback
 */
exports.all = function all(tasks, callback) {
  var finished = false;
  var pending = tasks.length;
  var results = new Array(tasks.length);

  var resultCollecter = function resultCollecter(i) {
    return function wrapper(err, result) {
      if (finished) {
        return; // Discard if already finished
      }

      if (err) {
        finished = true;
        callback(err);
        return;
      }

      pending -= 1;
      results[i] = result;

      if (pending === 0) {
        finished = true;
        callback(null, results);
        return;
      }
    };
  };

  object.forEach(tasks, function taskIterator(task, i) {
    task(resultCollecter(i));
  });
};

/**
 * Callbacks on the first task that get fullfiled or returns error
 *
 * @param {array.<function(done)>} tasks
 * @param {function} callback
 */
exports.any = function any(tasks, callback) {
  var finished = false;

  var errorCount = 0;
  var errors = [];

  var wrapper = function wrapper(i) {
    return function resultCollecterHandler(err, result) {
      if (finished) {
        return; // Discard if already finished
      }

      if (err) {
        errors[i] = err;
        errorCount += 1;

        if (errorCount === tasks.length) {
          finished = true;
          var error = new Error();
          error.message = 'All events have failed';
          error.internals = errors;
          callback(error);
          return;
        }

        return;
      }

      finished = true;
      callback(null, result);
    };
  };

  object.forEach(tasks, function taskIterator(task, index) {
    task(wrapper(index));
  });
};
