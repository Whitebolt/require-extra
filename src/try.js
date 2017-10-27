'use strict';

const {isBoolean, makeArray} = require('./util');
const {requireAsync, requireSync} = require('./require');

/**
 * Load a module or return a default value.  Can take an array to try.  Will load module asynchronously.
 *
 * @public
 * @param {string|Array} modulePath             Module path or array of paths.
 * @param {*} [defaultReturnValue=undefined]    The default value to return
 *                                              if module load fails.
 * @returns {Promise.<*>}
 */
function tryModule(useSync, modulePath, defaultReturnValue) {
  if (!isBoolean(useSync)) [defaultReturnValue, modulePath, useSync] = [modulePath, useSync, false];
  if (!modulePath) return defaultReturnValue;
  modulePath = makeArray(modulePath);

  const _require = (useSync ? requireSync : requireAsync);
  return _tryModule(modulePath, defaultReturnValue, _require);
}

/**
 * Load a module or return a default value.  Can take an array to try.  Will load module asynchronously.
 *
 * @private
 * @async
 * @param {Array.<string>} modulePath   Paths to try.
 * @param {*} defaultReturnValue        Default value to return.
 * @param {Function} require            Require to use.
 * @returns {*}
 */
async function _tryModule(modulePath, defaultReturnValue, require) {
  try {
    return await require(modulePath.shift());
  } catch (err) { }
  if(!modulePath.length) return defaultReturnValue;
  return tryModule(modulePath, defaultReturnValue, require);
}

module.exports = tryModule;