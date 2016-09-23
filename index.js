/* jshint node: true */

/**
 * @external bluebird
 * @see {@link https://github.com/petkaantonov/bluebird}
 */

'use strict';

const Promise = require('bluebird');  // jshint ignore:line
const fs = require('fs');
const readdir = Promise.promisify(fs.readdir);
const path = require('path');
const _eval = require('./lib/eval');
const _ = require('lodash');
const resolver = new (require('async-resolve'))();
const callsite = require('callsite');

const readFile = Promise.promisify(fs.readFile);
const defaultExt = resolver.getState().extensions;


/**
 * Resolve a module path starting from current directory via returned promise.
 *
 * @public
 * @param {Object} [userResolver=resolver]      User-created resolver function.
 * @param {string} moduleName                   Module name or path (same
 *                                              format as supplied
 *                                              to require()).
 * @returns {bluebird}
 */
function resolveModulePath(userResolver, moduleName) {
  moduleName = moduleName || userResolver;
  userResolver = userResolver || resolver;

  let dir = _getRoot(userResolver);
  return new Promise((resolve, reject)=>{
    _getResolve(userResolver).resolve(moduleName, dir, (err, modulePath)=>{
      if (err) return reject(err);
      return resolve(modulePath);
    });
  });
}

/**
 * Calculate the calling filename by examing the stack-trace.
 *
 * @private
 * @returns {string}      Filename of calling file.
 */
function _getCallingFileName() {
  let fileName;

  callsite().every(trace=>{
    let traceFile = trace.getFileName();
    if((traceFile !== __filename) && (!trace.isNative())){
      fileName = traceFile;
      return false;
    }

    return true;
  });

  return fileName;
}

/**
 * Calculate the calling directory path by examining the stack-trace.
 *
 * @private
 * @param {string} resolveTo    The directory to resolve to.
 * @returns {string}            Directory path
 */
function _getCallingDir(resolveTo) {
  callsite().every(trace=>{
    let traceFile = trace.getFileName();
    if((traceFile !== __filename) && (!trace.isNative())){
      if(resolveTo){
        resolveTo = path.resolve(path.dirname(traceFile), resolveTo);
      }else{
        resolveTo = path.resolve(path.dirname(traceFile));
      }

      return false;
    }

    return true;
  });

  return resolveTo;
}

/**
 * Get the root directory to use from the supplied object or calculate it.
 *
 * @private
 * @param {Object} obj    The options object containing a 'dir' property.
 * @returns {string}      The directory path.
 */
function _getRoot(obj) {
  return ((obj && obj.dir) ? _getCallingDir(obj.dir) : _getCallingDir());
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
 * Return given value as array.  If already an array, just return as-is.
 * Undefined will return an empty array.
 *
 * @private
 * @param {Array|*} [ary=[]]     Value to return as an array
 * @returns {Array}
 */
function _makeArray(ary=[]) {
  return (_.isArray(ary)?ary:[ary]);
}

/**
 * Load a module or return a default value.  Can take an array to try.  Will
 * load module asynchronously.
 *
 * @public
 * @param {string|Array} modulePath             Module path or array of paths.
 * @param {*} [defaultReturnValue=false]        The default value to return
 *                                              if module load fails.
 * @returns {bluebird}
 */
function getModule(useSync, modulePath, defaultReturnValue) {
  if (!_.isBoolean(useSync)) {
    defaultReturnValue = modulePath;
    modulePath = useSync;
    useSync = false;
  }

  let _require = (useSync ? _requireSync : requireAsync);
  if (modulePath) {
    modulePath = _makeArray(modulePath);
    return _require(modulePath.shift()).catch(error=>{
      if(modulePath.length) return getModule(modulePath, defaultReturnValue);
      return Promise.resolve([defaultReturnValue] || false);
    });
  }

  return Promise.resolve(defaultReturnValue || false);
}

/**
 * Read text from a file and handle any errors.
 *
 * @private
 * @param {string} fileName
 * @returns {bluebird}
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
function _loadModule(modulePath) {
  return _loadModuleText(modulePath).then(
    moduleText=>_evalModuleText(modulePath, moduleText)
  );
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
  return new Promise((resolve, reject)=>{
    process.nextTick(()=>{
      try {
        let mod = require(modulePath);
        resolve(mod);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Load a module
 *
 * @private
 * @param {Object} [userResolver=resolver]      User-created resolver function.
 * @param {string} moduleName                   Module name or path, same
 *                                              format as for require().
 * @param {boolean} [useSyncResolve=false]      Whether to use the native node
 *                                              require function (sychronous)
 *                                              or the require function from
 *                                              this module, which is async.
 * @returns {bluebird}
 */
function _loader(userResolver, moduleName, useSyncResolve) {
  if (arguments.length === 1) {
    userResolver = resolver;
    useSyncResolve = false;
  } else if ((arguments.length === 2) && (_.isString(userResolver))) {
    useSyncResolve = moduleName;
    moduleName = userResolver;
    userResolver = resolver;
  } else if (arguments.length === 2) {
    useSyncResolve = false;
  }

  return resolveModulePath(userResolver, moduleName).then(
    modulePath=>(useSyncResolve?_loadModuleSync:_loadModule)(modulePath),
    error=>Promise.reject(error)
  );
}

/**
 * Load a module asynchronously, this is an async version of require().  Will
 * load a collection of modules if an array is supplied.  Will reject if module
 * is not found or on error.
 *
 * @private
 * @param {Object} [userResolver=resolver]      User-created resolver function
 *                                              or an options object.
 * @param {string|Array} moduleName             Module name or path (or
 *                                              array of either), same format
 *                                              as for require().
 * @param {function} [callback]                 Node-style callback to use
 *                                              instead of (or as well as)
 *                                              returned promise.
 * @param {boolean} [useSyncResolve=false]      Whether to use the native node
 *                                              require function (sychronous)
 *                                              or the require function from
 *                                              this module, which is async.
 * @returns {bluebird}                          Promise, resolved with the
 *                                              module(s) or undefined.
 */
function _requireX(userResolver, moduleName, callback, useSyncResolve=false) {
  let async;
  if (_.isArray(moduleName)){
    async = Promise.all(moduleName.map(
      moduleName=>_loader(userResolver, moduleName, useSyncResolve)
    ));
  } else {
    async = _loader(userResolver, moduleName, useSyncResolve);
  }

  if (callback) {
    async.nodeify(callback, {spread: true});
  }

  return async;
}

/**
 * Load a module asynchronously, this is an async version of require().  Will
 * load a collection of modules if an array is supplied.  Will reject if module
 * is not found or on error.
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
 * @returns {bluebird}                          Promise, resolved with the
 *                                              module(s) or undefined.
 */
function requireAsync(userResolver, moduleName, callback) {
  if(_.isString(userResolver) || _.isArray(userResolver)){
    callback = moduleName;
    moduleName = userResolver;
    userResolver = resolver;
  }

  return _requireX(userResolver, moduleName, callback, false);
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
 * @returns {bluebird}                          Promise, resolved with the
 *                                              module(s) or undefined.
 */
function _requireSync(userResolver, moduleName, callback) {
  if(_.isString(userResolver) || _.isArray(userResolver)){
    callback = moduleName;
    moduleName = userResolver;
    userResolver = resolver;
  }

  return _requireX(userResolver, moduleName, callback, true);
}

/**
 * Get a list of files in the directory.
 *
 * @private
 * @param {string} dirPath            Directory path to scan.
 * @param {string} [ext=defaultExt]   File extension filter to use.
 * @returns {bluebird}                Promise resolving to array of files.
 */
function _filesInDirectory(dirPath, ext=defaultExt) {
  dirPath = path.resolve(path.dirname(_getCallingFileName()), dirPath);
  let xExt = _getExtensionRegEx(ext);

  return readdir(dirPath).then(
    file=>file, err=>[]
  ).filter(
    fileName=>xExt.test(fileName)
  ).map(
    fileName=>path.resolve(dirPath, fileName)
  );
}

/**
 * Take a file path and return the filename (without an extension).  Possible
 * extensions are passed in or the module default is used.
 *
 * @private
 * @param {string} filePath                 File path to get filename from.
 * @param {Array|string} [ext=defaultExt]   File extension(s) to remove.
 * @returns {string}                        The filename without given extension(s).
 */
function _getFileName(filePath, ext=defaultExt) {
  return path.basename(filePath).replace(_getExtensionRegEx(ext), '');
}

/**
 * Get a regular expression for the given selection of file extensions, which
 * will then be able to match file paths, which have those extensions.
 *
 * @private
 * @param {Array|string} [ext=defaultExt]     The extension(s).
 * @returns {RegExp}                          File path matcher.
 */
function _getExtensionRegEx(ext=defaultExt) {
  let _ext = '(?:' + _makeArray(ext).join('|') + ')';
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
  let extension =  _makeArray(options.extension || defaultExt);
  return _.uniq(
    [path.basename(fileName)].concat(
      extension.map(ext=>path.basename(fileName, ext)
     )
    )
  ).filter(value=>value);
}

/**
 * Can a filename be imported according to the rules the suppllied options.
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
  if (options.includes) return (_.intersection(options.includes, _fileName).length > 0);
  if (options.excludes) return (_.intersection(options.includes, _fileName).length === 0);
  return true;
}

/**
 * Import an entire directory (excluding the file that does the import if it is
 * in the same directory).
 *
 * @public
 * @param {string} dirPath                                Directory to import.
 * @param {Object} [options]                              Import options.
 * @param {Array|string} [options.extension=defaultExt]   Extension of files
 *                                                        to import.
 * @param {Object} [options.imports={}]                   Object to
 *                                                        import into.
 * @param {Function} [options.callback]                   Callback to fire
 *                                                        on each
 *                                                        successful import.
 * @param {boolean} [options.merge=false]                 Merge exported
 *                                                        properties & methods
 *                                                        together.
 * @returns {bluebird}
 */
function importDirectory(dirPath, options) {
  options = options || {};
  let imports = (options.imports ? options.imports : {});
  let caller = _getCallingFileName();
  let _require = (options.useSyncRequire ? _requireSync : requireAsync);

  return _filesInDirectory(dirPath, options.extension).map(fileName=>{
    if (_canImport(fileName, caller, options)) {
      return _require(fileName).then(
        mod=>Promise.resolve(mod)
      ).then(mod=>{
        if (options.merge === true) {
          if (_.isFunction(mod)) {
            imports[_getFileName(fileName, options.extension)] = mod;
          } else {
            _.assign(imports, mod);
          }
        } else {
          imports[_getFileName(fileName, options.extension)] = mod;
        }

        if (options.callback) options.callback(fileName, mod);
      });
    } else {
      return fileName;
    }
  }).then(fileNames=>imports);
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
function getResolver(options) {
  return new (require('async-resolve'))(options || {});
}

requireAsync.resolve = resolveModulePath;
requireAsync.getModule = getModule;
requireAsync.getResolver = getResolver;
requireAsync.importDirectory = importDirectory;

/**
 * NodeJs module loading with an asynchronous flavour
 *
 * @module require-extra
 * @version 0.3.12
 * @type {function}
 */
module.exports = requireAsync;
