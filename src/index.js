/* jshint node: true */

'use strict';

const config = new Map();

_set('resolver', require('resolve'));
_set('extensions', ['.js', '.json', '.node']);
_set('moduleDirectory', 'node_modules');

const path = require('path');
const _eval = require('./eval');
const {
  isString,
  isBoolean,
  isFunction,
  intersection,
  uniq,
  readDir,
  readFile,
  makeArray,
  promisify,
  flattenDeep
} = require('./util');
const resolver = getResolver();
const callsite = require('callsite');


/**
 * Resolve a module path starting from current directory via returned promise.
 *
 * @public
 * @param {Object} [userResolver=resolver]      User-created resolver function.
 * @param {string} moduleName                   Module name or path (same
 *                                              format as supplied
 *                                              to require()).
 * @returns {Promise.<string>}
 */
function resolveModulePath(userResolver, moduleName) {
  [moduleName, userResolver] = [moduleName || userResolver, userResolver || resolver];
  let dir = _getRoot(userResolver);
  return _getResolve(userResolver).resolve(moduleName, dir);
}

/**
 * Calculate the calling filename by examing the stack-trace.
 *
 * @private
 * @returns {string}      Filename of calling file.
 */
function _getCallingFileName() {
  const filetrace = [...stackIterator()];
  return filetrace[filetrace.lastIndexOf(__filename)+1];
}

/**
 * Generator for all the files in the current stack trace.
 *
 * @generator
 * @yield {string}    Full path of file.
 */
function* stackIterator() {
  const trace = callsite();
  for (let n=0; n<trace.length; n++) {
    if (!trace[n].isNative()) {
      const filename = trace[n].getFileName();
      if (filename) yield filename;
    }
  }
}

/**
 * Calculate the calling directory path by examining the stack-trace.
 *
 * @private
 * @param {string} resolveTo    The directory to resolve to.
 * @returns {string}            Directory path
 */
function _getCallingDir(resolveTo) {
  const filename = _getCallingFileName();
  if (filename) return path.resolve(...[path.dirname(filename), ...makeArray(resolveTo)]);
}

/**
 * Get the root directory to use from the supplied object or calculate it.
 *
 * @private
 * @param {Object} obj    The options object containing a 'dir' property.
 * @returns {string}      The directory path.
 */
function _getRoot(obj) {
  return _getCallingDir(((obj && obj.dir) ? obj.dir : undefined));
}

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
  return (obj ? (obj.resolver || (obj.resolve?obj:resolver)) : resolver);
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
 * @param {string} modulePath   The path of the evaluated module.
 * @param {string} moduleText   The text content of the module.
 * @returns {*}
 */
function _evalModuleText(modulePath, moduleText) {
  if (/\.json$/.test(modulePath)) {
    return JSON.parse(moduleText);
  } else {
    return (
      (moduleText !== undefined)?
        _eval(moduleText, modulePath, {}, true):
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
async function _loadModule(modulePath) {
  return _evalModuleText(modulePath, await _loadModuleText(modulePath));
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
function _loadModuleSync(modulePath) {
  return promisify(setImmediate)().then(()=>require(modulePath));
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
  return (useSyncResolve?_loadModuleSync:_loadModule)(modulePath);
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
 * Load a module asynchronously, this is an async version of require().  Will
 * load a collection of modules if an array is supplied.  Will reject if module
 * is not found or on error.
 *
 * This version still uses the native require() from node but resolves the path
 * using async methodology.
 *
 * @public
 * @param {Object} [userResolver=resolver]      User-created resolver function
 *                                              or an options object.
 * @param {string|Array} moduleName             Module name or path (or
 *                                              array of either), same format
 *                                              as for require().
 * @param {function} [callback]                 Node-style callback to use
 *                                              instead of (or as well as)
 *                                              returned promise.
 * @returns {Promise.<*>}                       Promise, resolved with the
 *                                              module(s) or undefined.
 */
function _requireSync(userResolver, moduleName, callback) {
  if(isString(userResolver) || Array.isArray(userResolver)) {
    [callback, moduleName, userResolver] = [moduleName, userResolver, resolver];
  }
  return _requireX(userResolver, moduleName, callback, true);
}

/**
 * Get a list of files in the directory.
 *
 * @private
 * @param {string} dirPath                    Directory path to scan.
 * @param {string} [ext=_get('extensions')]   File extension filter to use.
 * @returns {Promise.<string[]>}              Promise resolving to array of files.
 */
async function _filesInDirectory(dirPath, ext=_get('extensions')) {
  dirPath = _getCallingDir(dirPath);
  let xExt = _getExtensionRegEx(ext);

  try {
    return (await readDir(dirPath)).filter(
      fileName=>xExt.test(fileName)
    ).map(
      fileName=>path.resolve(dirPath, fileName)
    );
  } catch (err) {
    return [];
  }
}

async function filesInDirectories(dirPaths, ext=_get('extensions')) {
  let files = await Promise.all(dirPaths.map(dirPath=>_filesInDirectory(dirPath, ext)));
  return flattenDeep(files);
}

/**
 * Take a file path and return the filename (without an extension).  Possible
 * extensions are passed in or the module default is used.
 *
 * @private
 * @param {string} filePath                         File path to get filename from.
 * @param {Array|string} [ext=_get('extensions')]   File extension(s) to remove.
 * @returns {string}                                The filename without given extension(s).
 */
function _getFileName(filePath, ext=_get('extensions')) {
  return path.basename(filePath).replace(_getExtensionRegEx(ext), '');
}

/**
 * Get a regular expression for the given selection of file extensions, which
 * will then be able to match file paths, which have those extensions.
 *
 * @private
 * @param {Array|string} [ext=_get('extensions')]     The extension(s).
 * @returns {RegExp}                                  File path matcher.
 */
function _getExtensionRegEx(ext=_get('extensions')) {
  let _ext = '(?:' + makeArray(ext).join('|') + ')';
  return new RegExp(_ext + '$');
}

/**
 * Get the extension names for a given filename
 *
 * @private
 * @param {string} fileName   The filename to get the extension of.
 * @param {Object} [options]  Options containing the file extension (or not).
 * @returns {Array}
 */
function _getFileTests(fileName, options={}) {
  let extension =  makeArray(options.extension || _get('extensions'));
  return uniq(
    [path.basename(fileName)].concat(
      extension.map(ext=>path.basename(fileName, ext)
      )
    )
  ).filter(value=>value);
}

/**
 * Can a filename be imported according to the rules the supplied options.
 *
 * @private
 * @param {string} fileName         Filename to test.
 * @param {string} callingFileName  Calling filename (file doing the import).
 * @param {Object} options          Import/Export options.
 * @returns {boolean}
 */
function _canImport(fileName, callingFileName, options) {
  if (fileName === callingFileName) return false;
  let _fileName = _getFileTests(fileName, options);
  if (options.includes) return (intersection(options.includes, _fileName).length > 0);
  if (options.excludes) return (intersection(options.includes, _fileName).length === 0);
  return true;
}

/**
 * Import an entire directory (excluding the file that does the import if it is in the same directory).
 *
 * @async
 * @param {string} dirPath                                        Directory to import.
 * @param {Object} [options]                                      Import options.
 * @param {Array|string} [options.extension=_get('extensions')]   Extension of files to import.
 * @param {Object} [options.imports={}]                           Object to import into.
 * @param {Function} [options.onload]                             Callback to fire on each successful import.
 * @param {boolean} [options.merge=false]                         Merge exported properties & methods together.
 * @returns {Promise.<Object>}
 */
async function _importDirectory(dirPath, options={}) {
  _importDirectoryOptionsParser(options);
  const modDefs = await _importDirectoryModules(dirPath, options);

  modDefs.forEach(([fileName, module])=>{
    if (options.onload) options.onload(fileName, module);
    if ((options.merge === true) && (!isFunction(module))) return Object.assign(options.imports, module);
    options.imports[_getFileName(fileName, options.extension)] = module;
  });

  return options.imports;
}

/**
 * Parse the input options, filling-in any defaults.
 *
 * @private
 * @param {Object} [options={}]   The options to parse.
 * @returns {Object}
 */
function _importDirectoryOptionsParser(options={}) {
  options.imports = options.imports || {};
  options.onload = options.onload || options.callback;
  options.useSyncRequire = !!options.useSyncRequire;
  options.merge = !!options.merge;
  options.extension = _get('extensions');
  if (options.callback) console.warn('The options.callback method is deprecated, please use options.onload() instead.');

  return options;
}

/**
 * Take a directory path(s) and pull-in all modules returning an array with the filename as the first item
 * and module as the second
 *
 * @private
 * @async
 * @param {string|Array.<string>} dirPath     Directories to import.
 * @param {Object} options                    Import options.
 * @returns {Promise.<Array>}                 The module definitions.
 */
async function _importDirectoryModules(dirPath, options) {
  const caller = _getCallingFileName();
  const require = (options.useSyncRequire ? _requireSync : requireAsync);
  const files = await filesInDirectories(makeArray(dirPath), options.extension);
  const modDefs = await Promise.all(files.map(async (fileName)=> {
    if (_canImport(fileName, caller, options)) return [fileName, await require(fileName)];
  }));

  return modDefs.filter(modDef=>modDef);
}

/**
 * Import all the modules in a set of given paths,according to the supplied options.
 *
 * @public
 * @param {string|Array.<string>} dirPath   The path(s) to import frpm.
 * @param {Object} [options='']             The option to use in the import.
 * @param {Function} [callback]             Node-style callback to fire, use if you do not want a promise.
 * @returns {Promise.<Object>}
 */
function importDirectory(dirPath, options, callback) {
  if (!callback) return _importDirectory(dirPath, options);
  _importDirectory(dirPath, options).then(
    imports=>setImmediate(()=>callback(null, imports)),
    err=>setImmediate(()=>callback(err, undefined))
  );
}

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

  const _require = (useSync ? _requireSync : requireAsync);
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

/**
 * Generate a new resolver object following specific rules defined in the
 * options parameter. If no options are supplied, return a default resolver.
 *
 * @public
 * @param {Object} options    Options to pass to the resolver object
 * @returns {Object}          The new resolver object or the current module
 *                            resolver if no options supplied.
 */
function getResolver(options={}) {
  const _options = Object.assign({
    extensions: _get('extensions'),
    moduleDirectory: options.moduleDirectory || options.modules || _get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  return {
    resolve: (moduleId, dir, cb)=>{
      const resolver = _get('resolver');
      if (cb) {
        return resolver(moduleId, Object.assign(_options, {basedir:dir || __dirname}), cb);
      } else {
        return new Promise((resolve, reject)=>{
          resolver(moduleId, Object.assign(_options, {basedir:dir || __dirname}), (err, results)=>{
            if (err) return reject(err);
            return resolve(results);
          });
        })
      }
    },
    addExtensions: (...ext)=>{
      _options.extensions.push(...flattenDeep(ext));
      _options.extensions = uniq(_options.extensions);
      return  _options.extensions;
    },
    removeExtensions: (...ext)=>{
      flattenDeep(ext).forEach(ext=>{
        _options.extensions = _options.extensions.filter(_ext=>(ext !== _ext))
      });
      return  _options.extensions;
    },
    getState: ()=>Object.assign({}, _options),
    isCoreModule: moduleId=>!!_get('resolver').isCore(moduleId)
  }
}

/**
 * Load a module asynchronously, this is an async version of require().  Will load a collection of modules if an array
 * is supplied.  Will reject if module is not found or on error.
 *
 * @public
 * @param {Object} [userResolver=resolver]      User-created resolver function or an options object.
 * @param {string|Array} moduleName             Module name or path (or array of either), same format as for require().
 * @param {function} [callback]                 Node-style callback to use instead of (or as well as) returned promise.
 * @returns {Promise.<*>}                       Promise, resolved with the module(s) or undefined.
 */
function requireAsync(...params) {
  const userResolver = ((isString(params[0]) || Array.isArray(params[0])) ? resolver : params.shift());
  const [moduleName, callback] = params;
  return _requireX(userResolver, moduleName, callback, false);
}

function _set(key, value) {
  config.set(key, value);
}

function _get(key) {
  return config.get(key);
}

function _delete(key) {
  config.delete(key);
}

function promiseLibraryWrap(func) {
  if (_get('Promise')) return _get('Promise').resolve(func);
  return func;
}

requireAsync.resolve = promiseLibraryWrap(resolveModulePath);
requireAsync.getModule = (...params)=>{
  console.warn('Use of getModule() is deprecated, please use try() instead, it is exactly the same.')
  return promiseLibraryWrap(tryModule(...params));
};
requireAsync.try = promiseLibraryWrap(tryModule);
requireAsync.getResolver = promiseLibraryWrap(getResolver);
requireAsync.importDirectory = promiseLibraryWrap(importDirectory);
requireAsync.get = _get;
requireAsync.set = _set;
requireAsync.delete = _delete;



/**
 * NodeJs module loading with an asynchronous flavour
 *
 * @module require-extra
 * @version 0.4.0
 * @type {function}
 */
module.exports = requireAsync;

try {
  __module.exports = module.exports;
} catch(err) {}
