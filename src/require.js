'use strict';

const settings = require('./settings');
const _eval = require('./eval');
const requireLike = require('require-like');
const Resolver = require('./resolver');
const cache = require('./cache');
const Module = require('./Module');
const path = require('path');
const {isString, readFile, readFileSync, getCallingDir, promisify} = require('./util');
const emitter = require('./events');

const xIsJson = /\.json$/;
const xIsJsonOrNode = /\.(?:json|node)$/;


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
  if (!obj) return settings.get('resolver');
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
  return (getCallingDir(((obj && obj.basedir) ? obj.basedir : undefined)) || (obj?obj.basedir:undefined));
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
  [moduleName, userResolver] = [moduleName || userResolver, userResolver || settings.get('resolver')];
  let dir = _getRoot(userResolver);
  return _getResolve(userResolver).resolve(moduleName, dir);
}

/**
 * Resolve a module path starting from current directory via returned promise.
 *
 * @public
 * @param {Object} [userResolver=config.get('resolver')]    User-created resolver function.
 * @param {string} moduleName                               Module name or path (same format as supplied to require()).
 * @returns {Promise.<string>}
 */
function resolveModulePathSync(userResolver, moduleName) {
  [moduleName, userResolver] = [moduleName || userResolver, userResolver || settings.get('resolver')];
  let dir = _getRoot(userResolver);
  return _getResolve(userResolver).resolveSync(moduleName, dir);
}

/**
 * Read text from a file and handle any errors.
 *
 * @private
 * @param {string} target               The target to load.
 * @param {string} source               The loading source path.
 * @param {boolean} [sync=false]        Use sync method?
 * @returns {Promise.<string>|string}   The results.
 */
function _loadModuleText(target, source, sync=false) {
  const time = process.hrtime();

  const loaded = txt=>{
    try {
      emitter.emit('loaded', new emitter.Loaded({target, duration: process.hrtime(time), source}));
      return txt;
    } catch (error) { return loadError(error); }
  };

  const loadError = error=>{
    const _error = new emitter.Error({target, source, error});
    emitter.emit('error', _error);
    if (!_error.ignore()) throw error;
  };

  if (sync) return loaded(readFileSync(target, 'utf-8'));
  return readFile(target, 'utf8').then(loaded, loadError);
}

/**
 * Evaluate module text in similar fashion to require evaluations, returning the module.
 *
 * @private
 * @param {string} filename                   The path of the evaluated module.
 * @param {string} content                    The text content of the module.
 * @param {Resolver|Object} [userResolver]    Resolver to use, if not a resolver assume it is config for a new resolver.
 * @returns {Module}                          The new module.
 */
function _evalModuleText(filename, content, userResolver) {
  if (content === undefined) return;

  const moduleConfig = _createModuleConfig(filename, content, _getResolve(userResolver));
  if (xIsJsonOrNode.test(filename)) {
    const time = process.hrtime();
    const module = new Module(moduleConfig);

    if (xIsJson.test(filename)) {
      module.exports = JSON.parse(content);
    } else {
      module.exports = process.dlopen(module, filename);
    }

    module.loaded = true;

    emitter.emit('evaluated', new emitter.Evaluated({
      target:module.filename,
      source:(module.parent || {}).filename,
      duration:process.hrtime(time),
      cacheSize: cache.size
    }));

    return module;
  } else {
    return _eval(moduleConfig);
  }
}

/**
 * Create a config object to pass to _eval or Module constructor using supplied filename, content and Resolver.
 *
 * @private
 * @param {string} filename           The filename to create for.
 * @param {string|Buffer} content     The content of the file.
 * @param {Resolver} userResolver     The Resolver being used.
 * @returns {Object}                  The new config object.
 */
function _createModuleConfig(filename, content, userResolver) {
  return Object.assign({
    content,
    filename,
    includeGlobals:true,
    syncRequire:_syncRequire(_syncRequire),
    resolveModulePath,
    basedir: path.dirname(filename)
  }, userResolver.export);
}

/**
 * Load and evaluate a module returning undefined to promise resolve
 * on failure.
 *
 * @private
 * @param {string} filename                   The path of the evaluated module.
 * @param {Resolver|Object} [userResolver]    Resolver to use, if not a resolver assume it is config for a new resolver.
 * @returns {Promise.<*>}                     The exports of the module
 */
async function _loadModule(filename, userResolver) {
  if (!cache.has(filename)) {
    cache.set(filename, _evalModuleText(filename, await _loadModuleText(filename, userResolver.parent), userResolver));
  }
  return cache.get(filename).exports;
}

/**
 * Load and evaluate a module returning undefined to promise resolve
 * on failure.
 *
 * @private
 * @param {string} filename                   The path of the evaluated module.
 * @param {Resolver|Object} [userResolver]    Resolver to use, if not a resolver assume it is config for a new resolver.
 * @returns {*}                               The exports of the module
 */
function _loadModuleSync(filename, userResolver) {
  if (!cache.has(filename)) {
    cache.set(filename, _evalModuleText(filename, _loadModuleText(filename, userResolver.parent, true), userResolver));
  }
  return cache.get(filename).exports;
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
 * @param {string} filename                 The path of the evaluated module.
 * @param {Resolver|Object} [userResolver]    Resolver to use, if not a resolver assume it is config for a new resolver.
 * @returns {*}
 */
async function _loadModuleSyncAsync(filename, userResolver) {
  const localRequire = requireLike(_getResolve(userResolver).parent || settings.get('parent').filename);
  await promisify(setImmediate)();
  return localRequire(filename);
}

/**
 * Load a module
 *
 * @private
 * @param {Object} userResolver         User-created resolver function.
 * @param {string} moduleId             Module name or path, same format as for require().
 * @param {boolean} useSyncResolve      Whether to use the native node require function (sychronous) or the require
 *                                      function from this module, which is async.
 * @returns {Promise.<*|undefined>}     The module or undefined.
 */
async function _loader(userResolver, moduleId, useSyncResolve) {
  const modulePath = await resolveModulePath(userResolver, moduleId);
  return (useSyncResolve?_loadModuleSyncAsync:_loadModule)(modulePath, userResolver);
}

/**
 * Load a module asynchronously, this is an async version of require().  Will
 * load a collection of modules if an array is supplied.  Will reject if module
 * is not found or on error.
 *
 * @private
 * @param {Object} userResolver                 User-created resolver function or an options object.
 * @param {string|Array} moduledId              Module name or path (or array of either), same format as for require().
 * @param {function} [callback]                 Node-style callback to use instead of (or as well as) returned promise.
 * @param {boolean} [useSyncResolve=false]      Whether to use the native node require function (sychronous) or the
 *                                              require function from this module, which is async.
 * @returns {Promise.<*|undefined>}             Promise, resolved with the module(s) or undefined.
 */
async function _requireX(userResolver, moduledId, callback, useSyncResolve=false) {
  if (userResolver.dir) {
    console.warn(`The property userResolver.dir is deprecated, please use userResolver.basedir instead. This being used in ${getCallingFileName()}`);
  }

  userResolver.basedir = userResolver.basedir || userResolver.dir;

  try {
    const modules = await (Array.isArray(moduledId) ?
        Promise.all(moduledId.map(moduleName=>_loader(userResolver, moduleName, useSyncResolve))) :
        _loader(userResolver, moduledId, useSyncResolve)
    );

    if (!callback) return modules;
    setImmediate(()=>callback(null, modules));
  } catch (err) {
    if (!callback) return Promise.reject(err);
    setImmediate(()=>callback(err, undefined));
  }
}

/**
 * Take arguments supplied to the different require function and parse ready for internal use.
 *
 * @private
 * @param {Resolver} [userResolver]                               Resolver to use.
 * @param {string} moduleId                                       The module to load.
 * @param {Function} [callback]                                   Node-style callback to fire if promise not wanted.
 * @param {boolean} [useSyncResolve=false]                        Use the native require to child requires?
 * @returns {[{Resolver}, {string}, {Function}, {boolean}]}       Parsed parameters, ready for use.
 */
function _parseRequireParams([userResolver, moduleId, callback], useSyncResolve=false) {
  if(isString(userResolver) || Array.isArray(userResolver)) {
    return [settings.get('resolver'), userResolver, moduleId, useSyncResolve];
  }else {
    return [_getResolve(userResolver), moduleId, callback, useSyncResolve];
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
 * @param {string|Array} moduleId                             Module name or path (or array of either), same format
 *                                                            as for require().
 * @param {function} [callback]                               Node-style callback to use instead of (or as well as)
 *                                                            returned promise.
 * @returns {Promise.<*>}                                     Promise, resolved with the module(s) exports or undefined.
 */
function requireSync(userResolver, moduleId, callback) {
  return _requireX(..._parseRequireParams([userResolver, moduleId, callback], true));
}

/**
 * Load a module asynchronously, this is an async version of require().  Will load a collection of modules if an array
 * is supplied.  Will reject if module is not found or on error.
 *
 * @public
 * @param {Object} [userResolver=config.get('resolver')]      User-created resolver function or an options object.
 * @param {string|Array} moduleId                             Module name or path (or array of either), same format as
 *                                                            for require().
 * @param {function} [callback]                               Node-style callback to use instead of (or as well as) returned promise.
 * @returns {Promise.<*>}                                     Promise, resolved with the module(s) exports or undefined.
 */
function requireAsync(userResolver, moduleId, callback) {
  return _requireX(..._parseRequireParams([userResolver, moduleId, callback]));
}

/**
 * CommonJs require function, similar to node.js native version but with extra features of this module.
 *
 * @param {Resolver} [userResolver]   Resolver to use in requiring.
 * @param {string} moduleId           Module to load.
 * @returns {*}                       Module exports
 */
function syncRequire(...params) {
  const [userResolver, moduleId] = _parseRequireParams(params);
  if (userResolver.isCoreModule(moduleId)) return __require(moduleId);
  userResolver.basedir = userResolver.basedir || userResolver.dir;
  const filename = resolveModulePathSync(userResolver, moduleId, true);
  return _loadModuleSync(filename, userResolver);
}

function _syncRequire(userResolver={}) {
  return (...params)=>{
    const [_userResolver, moduleId] = _parseRequireParams(params);
    return syncRequire(Object.assign({}, userResolver, _userResolver), moduleId);
  };
}


module.exports = {
  requireAsync, requireSync, resolveModulePath, syncRequire
};