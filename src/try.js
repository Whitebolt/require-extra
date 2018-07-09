'use strict';

const settings = require('./settings');
const {isBoolean, makeArray} = require('./util');
const {requireAsync, syncRequire} = require('./require');

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
  if (!isBoolean(useSync)) [defaultReturnValue, modulePath, useSync] = [modulePath, useSync, settings.get('useSyncRequire')];
  if (!modulePath) return defaultReturnValue;
  modulePath = makeArray(modulePath);

  return (useSync ?
    _tryModuleSync(modulePath, defaultReturnValue) :
    _tryModule(modulePath, defaultReturnValue)
  );
}

/**
 * Load a module or return a default value.  Can take an array to try.  Will load module asynchronously.
 *
 * @private
 * @async
 * @param {Array.<string>} modulePath   Paths to try.
 * @param {*} defaultReturnValue        Default value to return.
 * @returns {*}
 */
async function _tryModule(modulePath, defaultReturnValue) {
  try {
    return await requireAsync({squashErrors:true}, modulePath.shift());
  } catch (err) { }
  if(!modulePath.length) return defaultReturnValue;
  return _tryModule(modulePath, defaultReturnValue);
}

/**
 * Load a module or return a default value.  Can take an array to try.  Will load module synchronously.
 *
 * @private
 * @async
 * @param {Array.<string>} modulePath   Paths to try.
 * @param {*} defaultReturnValue        Default value to return.
 * @returns {*}
 */
function _tryModuleSync(modulePath, defaultReturnValue) {
  try {
    return syncRequire({squashErrors:true}, modulePath.shift());
  } catch (err) { }
  if(!modulePath.length) return defaultReturnValue;
  return _tryModuleSync(modulePath, defaultReturnValue);
}

module.exports = tryModule;