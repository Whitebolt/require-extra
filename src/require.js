'use strict';

const config = require('./config');
const _eval = require('./eval');
const requireLike = require('require-like');
const Resolver = require('./resolver');
const cache = require('./cache');
const path = require('path');

const {isString, readFile, getCallingDir, promisify} = require('./util');


/**
 * Get the resolver object from a given object.  Assumes it has received
 * either an actual resolver or an options object with resolver in it.  If this
 * is not true then return the default resolver.
 *
 * @private
 * @param {Object} obj    Object to get resolver from.
 * @returns {Object}      The resolver object.
 */
function _getResolve(obj) {
  if (!obj) return config.get('resolver');
  if (obj instanceof Resolver) return obj;
  if (obj.resolver) return obj.resolver;
  let pass = true;
  Resolver.resolveLike.forEach(property=>{pass &= (property in obj);});
  if (pass) return obj;
  return new Resolver(obj);
}

/**
 * Get the root directory to use from the supplied object or calculate it.
 *
 * @private
 * @param {Object} obj    The options object containing a 'dir' property.
 * @returns {string}      The directory path.
 */
function _getRoot(obj) {
  return getCallingDir(((obj && obj.basedir) ? obj.basedir : undefined));
}

/**
 * Resolve a module path starting from current directory via returned promise.
 *
 * @public
 * @param {Object} [userResolver=config.get('resolver')]    User-created resolver function.
 * @param {string} moduleName                               Module name or path (same format as supplied to require()).
 * @returns {Promise.<string>}
 */
function resolveModulePath(userResolver, moduleName) {
  [moduleName, userResolver] = [moduleName || userResolver, userResolver || config.get('resolver')];
  let dir = _getRoot(userResolver);
  return _getResolve(userResolver).resolve(moduleName, dir);
}

/**
 * Read text from a file and handle any errors.
 *
 * @private
 * @param {string} fileName
 * @returns {Promise.<string>}
 */
function _loadModuleText(fileName) {
  return readFile(fileName, 'utf8');
}

/**
 * Evaluate module text in similar fashion to require evaluations.
 *
 * @private
 * @param {string} filename   The path of the evaluated module.
 * @param {string} content   The text content of the module.
 * @returns {*}
 */
function _evalModuleText(filename, content) {
  if (/\.json$/.test(filename)) {
    return {
      exports: JSON.parse(content),
      __filename: filename,
      __dirname: path.dirname(filename)
    }
  } else {
    return (
      (content !== undefined)?
        _eval({content, filename, includeGlobals:true}):
        undefined
    );
  }
}

/**
 * Load and evaluate a module returning undefined to promise resolve
 * on failure.
 *
 * @private
 * @param {string} modulePath   The path of the evaluated module.
 * @returns {*}
 */
async function _loadModule(modulePath, userResolver) {
  if (!cache.has(modulePath)) {
    const exports = _evalModuleText(modulePath, await _loadModuleText(modulePath));
    cache.set(modulePath, exports);
  }
  return cache.get(modulePath).exports;
}

/**
 * This is a sychronous version of loadModule.  The module is still resolved
 * using async methods but the actual loading is done using the native require
 * from node.
 *
 * Load and evaluate a module returning undefined to promise resolve
 * on failure.
 *
 * @private
 * @param {string} modulePath   The path of the evaluated module.
 * @returns {*}
 */
async function _loadModuleSync(modulePath, userResolver) {
  const localRequire = requireLike(userResolver.parent || config.get('parent').filename);
  await promisify(setImmediate)();
  return localRequire(modulePath);
}

/**
 * Load a module
 *
 * @private
 * @param {Object} userResolver         User-created resolver function.
 * @param {string} moduleName           Module name or path, same format as for require().
 * @param {boolean} useSyncResolve      Whether to use the native node require function (sychronous) or the require
 *                                      function from this module, which is async.
 * @returns {Promise.<*|undefined>}     The module or undefined.
 */
async function _loader(userResolver, moduleName, useSyncResolve) {
  const modulePath = await resolveModulePath(userResolver, moduleName);
  return (useSyncResolve?_loadModuleSync:_loadModule)(modulePath, userResolver);
}

/**
 * Load a module asynchronously, this is an async version of require().  Will
 * load a collection of modules if an array is supplied.  Will reject if module
 * is not found or on error.
 *
 * @private
 * @param {Object} userResolver                 User-created resolver function or an options object.
 * @param {string|Array} moduleName             Module name or path (or array of either), same format as for require().
 * @param {function} [callback]                 Node-style callback to use instead of (or as well as) returned promise.
 * @param {boolean} [useSyncResolve=false]      Whether to use the native node require function (sychronous) or the
 *                                              require function from this module, which is async.
 * @returns {Promise.<*|undefined>}             Promise, resolved with the module(s) or undefined.
 */
async function _requireX(userResolver, moduleName, callback, useSyncResolve=false) {
  if (userResolver.dir) {
    console.warn(`The property userResolver.dir is deprecated, please use userResolver.basedir instead. This being used in ${getCallingFileName()}`);
  }

  userResolver.basedir = userResolver.basedir || userResolver.dir;

  try {
    const modules = await (Array.isArray(moduleName) ?
        Promise.all(moduleName.map(moduleName=>_loader(userResolver, moduleName, useSyncResolve))) :
        _loader(userResolver, moduleName, useSyncResolve)
    );

    if (!callback) return modules;
    setImmediate(()=>callback(null, modules));
  } catch (err) {
    if (!callback) return Promise.reject(err);
    setImmediate(()=>callback(err, undefined));
  }
}

/**
 * Load a module asynchronously, this is an async version of require().  Will load a collection of modules if an array
 * is supplied.  Will reject if module is not found or on error.
 *
 * This version still uses the native require() from node but resolves the path using async methodology.
 *
 * @public
 * @param {Object} [userResolver=config.get('resolver')]      User-created resolver function or an options object.
 * @param {string|Array} moduleName                           Module name or path (or array of either), same format
 *                                                            as for require().
 * @param {function} [callback]                               Node-style callback to use instead of (or as well as)
 *                                                            returned promise.
 * @returns {Promise.<*>}                                     Promise, resolved with the module(s) or undefined.
 */
function requireSync(userResolver, moduleName, callback) {
  if(isString(userResolver) || Array.isArray(userResolver)) {
    [callback, moduleName, userResolver] = [moduleName, userResolver, config.get('resolver')];
  }
  return _requireX(_getResolve(userResolver), moduleName, callback, true);
}

/**
 * Load a module asynchronously, this is an async version of require().  Will load a collection of modules if an array
 * is supplied.  Will reject if module is not found or on error.
 *
 * @public
 * @param {Object} [userResolver=config.get('resolver')]      User-created resolver function or an options object.
 * @param {string|Array} moduleName                           Module name or path (or array of either), same format as
 *                                                            for require().
 * @param {function} [callback]                               Node-style callback to use instead of (or as well as) returned promise.
 * @returns {Promise.<*>}                                     Promise, resolved with the module(s) or undefined.
 */
function requireAsync(...params) {
  const userResolver = ((isString(params[0]) || Array.isArray(params[0])) ? config.get('resolver') : params.shift());
  const [moduleName, callback] = params;
  return _requireX(_getResolve(userResolver), moduleName, callback, false);
}

module.exports = {
  requireAsync, requireSync, resolveModulePath
};