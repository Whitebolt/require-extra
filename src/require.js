'use strict';

const settings = require('./settings');
const _eval = require('./eval');
const requireLike = require('require-like');
const Resolver = require('./resolver');
const cache = require('./cache');
const Module = require('./Module');
const path = require('path');
const toNamespacedPath = path.toNamespacedPath ? path.toNamespacedPath : path=>path;
const {isString, isFunction, readFile, readFileSync, getCallingDir, promisify, getRequire} = require('./util');
const emitter = require('./events');
const {fileCache, filePaths} = require('./stores');

const _xRequireExtract = /\brequire\s*?\(\s*?[\"\'](.*?)[\"\']\*?\)/g;


settings.set('load-simultaneously', 1000);

settings.set('.js', function(config) {
  _cacher(config.content, config.filename, config.basedir, config.resolver);
  const module = _eval(config);
  module.loaded = true;
  return module;
});

settings.set('.node', function(config) {
  const module = new Module(config);
  process.dlopen(module, toNamespacedPath(config.filename));
  module.loaded = true;
  return module;
});

settings.set('.json', function(config) {
  const module = new Module(config);
  if (Buffer.isBuffer(config.content)) config.content = config.content.toString();
  module.exports = JSON.parse(config.content);
  module.loaded = true;
  return module;
});


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
  const loadEventEvent = new emitter.Load({target, source, sync});
  const loadEvent = emitter.emit('load', loadEventEvent);

  const loaded = txt=>{
    try {
      const loadedEvent = emitter.emit('loaded', new emitter.Loaded({
        target,
        otherTarget: loadEventEvent.data.target,
        duration: process.hrtime(time),
        size: txt.length,
        source,
        sync
      }));
      return sync?txt:loadedEvent.then(()=>txt,loadError);
    } catch (error) {
      return loadError(error);
    }
  };

  const loadError = error=>{
    const _error = new emitter.Error({target, source, error});
    emitter.emit('error', _error);
    if (!_error.ignore || (_error.ignore && isFunction(_error.ignore) && !_error.ignore())) throw error;
  };

  if (!sync) return loadEvent.then(()=>readFile(loadEventEvent.data.target || target, fileCache).then(loaded, loadError), loadError);
  try {
    return loaded(readFileSync(loadEventEvent.data.target || target, fileCache));
  } catch(error) {
    loadError(error);
  }
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
function _evalModuleText(filename, content, userResolver, sync=true) {
  if (content === undefined) return;

  const ext = path.extname(filename);
  const config = _createModuleConfig(filename, content, _getResolve(userResolver));
  let module = _runEval(config, settings.get(ext) || function(){}, userResolver.options || {}, sync);

  if ((!(config.resolver || {}).squashErrors) && fileCache.has(filename)) fileCache.delete(filename);
  return module;
}

/**
 * Run the parser with the given configuration and deal with events, returning the module.
 *
 * @private
 * @param {Object} config
 * @param {Function} parser
 * @returns {Module}
 */
function _runEval(config, parser, options, sync=true) {
  const time = process.hrtime();
  const evalEvent = new emitter.Evaluate({
    target:config.filename,
    source:(config.parent || {}).filename,
    moduleConfig: config,
    parserOptions: options,
    sync
  });

  const evaluateEvent = emitter.emit('evaluate', evalEvent);

  function evaluated() {
    let module = ((evalEvent.data.module) ? evalEvent.data.module : parser.bind(settings)(config, options));
    if (!module || !module.loaded) return module;
    const evaluatedEvent =  emitter.emit('evaluated', new emitter.Evaluated({
      target:module.filename,
      source:(module.parent || {}).filename,
      duration:process.hrtime(time),
      cacheSize: cache.size,
      sync
    }));
    try {filePaths.set(module.exports, module.filename);} catch(err) {}

    return sync?module:evaluatedEvent.then(()=>module);
  }

  return sync?evaluated():evaluateEvent.then(evaluated);
}

function detective(content) {
  const found = [];
  let result;
  while ((result = _xRequireExtract.exec(content)) !== null) found.push(result[1]);
  return found;
}

/**
 * Try to pre-load requires by parsing the loaded text for requires (and descendants).
 *
 * @private
 * @param {string|Buffer} content     The module content.
 * @param {string} filename           The module filename.
 * @param {string} basedir            The module basedir.
 * @param {Resolver} userResolver     The Resolver used.
 */
function _cacher(content, filename, basedir, userResolver) {
  try {
    detective(content).map(moduleId=>{
      if (!userResolver.isCoreModule(moduleId)) {
        userResolver.resolve(moduleId, basedir).then(modulePath=>{
          if (!cache.has(modulePath) && !fileCache.has(modulePath)) {
            _loadModuleText(modulePath, filename).then(content=> {
              const _userResolver = new Resolver(Object.assign({}, userResolver, {basedir: path.dirname(modulePath)}));
              return _cacher(content, modulePath, path.dirname(modulePath), _userResolver)
            });
          }
        }, err=>true);
      }
    });
  } catch(err) {

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
    resolveModulePathSync,
    basedir: path.dirname(filename),
    resolver: userResolver
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
    await _evalModuleText(
      filename,
      await _loadModuleText(filename, userResolver.parent), userResolver, false
    ).then(
      module=>{
        if (module.exports === undefined) console.log("ERROR SET!", options.filename);
        cache.set(filename, module)
      }
    )
  }
  return cache.get(filename).exports;
}

/**
 * Load and evaluate a module returning undefined to promise resolve on failure.
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
  if (userResolver.isCoreModule(moduleId)) return getRequire()(moduleId);
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
  requireAsync, requireSync, resolveModulePath, resolveModulePathSync, syncRequire
};