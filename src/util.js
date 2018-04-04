'use strict';

const fs = require('fs');
const path = require('path');
const callsite = require('callsite');
const lodash = require('lodash');
const _util = require('util');
let settings;

const fileQueue = [];
let loading = 0;


/**
 * Turn the given value into an array.  If it is already an array then return it; if it is a set then convert to an
 * array; and if neither then return as the first item in an array. The purpose of this function is for function
 * or method parameters where they can be either a array or not.  You can use this to ensure you are working on
 * an array.
 *
 * @public
 * @param {Array|Set|*} value		Value to return or convert.
 * @returns {Array}					The converted value (or original if already an array).
 */
lodash.makeArray = function makeArray(value, defaultValue) {
  if (value === undefined) return [];
  if (value instanceof Set) return [...value];
  return lodash.castArray(value);
};

/**
 * Ponyfill for util.promisify if not available.
 *
 * @param {Function} func     Function to promisify.
 * @returns {Function}        Promisified function.
 */
lodash.promisify = function promisify(func) {
  if (_util.promisify) return _util.promisify(func);

  return (...params)=>{
    return new Promise((resolve, reject)=>{
      params.push((err, results,...moreResults)=>{
        if (err) return reject(err);
        if (moreResults.length) {
          moreResults.unshift(results);
          return resolve(moreResults);
        }
        return resolve(results);
      });
      func(...params);
    });
  };
};

/**
 * Calculate the calling filename by examing the stack-trace.
 *
 * @private
 * @returns {string}      Filename of calling file.
 */
lodash.getCallingFileName = function getCallingFileName() {
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

  const filetrace = [...stackIterator()];
  return filetrace[filetrace.lastIndexOf(__filename)+1];
};

/**
 * Calculate the calling directory path by examining the stack-trace.
 *
 * @private
 * @param {string} resolveTo    The directory to resolve to.
 * @returns {string}            Directory path
 */
lodash.getCallingDir = function getCallingDir(resolveTo) {
  const filename = lodash.getCallingFileName();
  if (filename) return path.resolve(...[path.dirname(filename), ...lodash.makeArray(resolveTo)]);
};

/**
 * Get all the property names (including inherited) of the given object.
 *
 * @public
 * @param {Object} obj		The object to get properties for.
 * @returns {Set}			A set of all the property names.
 */
lodash.getAllPropertyNames = function getAllPropertyNames(obj) {
  const all = new Set();

  do {
    Object.getOwnPropertyNames(obj).forEach(property=>all.add(property));
  } while (obj = Object.getPrototypeOf(obj));

  return all;
};

/**
 * Wrap the given returned promise in the module defined promise library.
 *
 * @param {Function} func                       Function to wrap.
 * @param {RequireExtraSettings|Map} settings   The module settings map.
 * @returns {Function}                          Wrapped function.
 */
lodash.promiseLibraryWrap = function promiseLibraryWrap(func, settings) {
  if (settings.has('Promise')) return settings.get('Promise').resolve(func);
  return func;
};

/**
 * Console warn about a deprecated method.
 *
 * @param {string} from         Old method name.
 * @param {string} to           New method name.
 * @param {Object} exported     Object to wrap method on.
 */
lodash.deprecated = function deprecated(from, to, exported) {
  exported[from] = (...params)=>{
    console.warn(`Use of ${from} is deprecated, please use ${to}() instead, it is exactly the same. This being used in ${lodash.getCallingFileName()}`);
    return exported[to](...params);
  };
};

/**
 * Reflect given methods from one object to another, keeping the original binding.
 *
 * @param {Object} from                      Object to reflect.
 * @param {Object} to                        Object to reflect to.
 * @param {Array.<string>|string} methods    Method(s) to reflect.
 */
lodash.reflect = function reflect(from, to, methods) {
  lodash.makeArray(methods).forEach(property=>{
    to[property] = (lodash.isFunction(from[property])?from[property].bind(from):from[property]);
  });
};


/**
 * Lop a path to its parent adding a directory on.
 *
 * @param {string} path             Path to lop.
 * @param {string} addition         Part to add to path.
 * @param {boolean} [first=false]   Is this the first instance (do not lop, just add).
 * @returns {string}                Lopped and added path.
 */
lodash.lopAdd = function lopAdd(path, addition, first=false) {
  let parts = path.split('/').filter(part=>part);
  if ((parts[parts.length-1] === addition) && parts.length) parts.pop();
  if (parts.length && !first) parts.pop();
  parts.push(addition);
  return '/'+parts.join('/');
};

/**
 * Generator to do a lopAdd on a given path back to root.
 *
 * @param {string} path       Path to do iterations on.
 * @param {string} addition   Directory we are adding.
 */
lodash.createLopAddIterator = function* createLopAddIterator(path, addition) {
  path = lodash.lopAdd(path, addition, true);
  while (path !== `/${addition}`) {
    yield path;
    path = lodash.lopAdd(path, addition);
  }
  yield path;
};

lodash.readDir = lodash.promisify(fs.readdir);
lodash.lstat = lodash.promisify(fs.lstat);

const readFileCallbacks = new Map();

/**
 * Add a callback for reading of given file.
 *
 * @private
 * @param {string} filename           File to set callback for.
 * @returns {Promise.<Buffer|*>}      The file contents, once loaded.
 */
function _addReadCallback(filename) {
  return new Promise((resolve, reject)=> {
    readFileCallbacks.get(filename).add((err, data)=> {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}

/**
 * Add callbacks set for given file
 *
 * @private
 * @param {string} filename     File to add for.
 * @param {Map} cache           Cache to use.
 * @returns {Set}               The callbacks.
 */
function _addReadCallbacks(filename, cache) {
  const callbacks = new Set();
  cache.set(filename, true);
  readFileCallbacks.set(filename, callbacks);
  return callbacks;
}

/**
 * Return cached file if already loaded or set a callback if currently loading/in-queue.
 *
 *
 * @param {string} filename           File to get from cache.
 * @param {Map} cache                 The cache to use.
 * @returns {Promise.<Buffer|*>}      The file contents.
 */
async function _handleFileInCache(filename, cache) {
  if (cache.get(filename) !== true) return cache.get(filename);
  return _addReadCallback(filename);
}

/**
 * Fire any awaiting callbacks for given file data.
 *
 * @private
 * @param {string} filename           The filename to fire callbacks on.
 * @param {Buffer|Error} data         The received data.
 * @param {boolean} [error=false]     Is this an error or file data?
 */
function _fireReadFileCallbacks(filename, data, error=false) {
  const callbacks = readFileCallbacks.get(filename);
  if (callbacks) {
    if (callbacks.size) callbacks.forEach(callback=>error?callback(data, null):callback(null, data));
    callbacks.clear();
    readFileCallbacks.delete(filename);
  }
}

/**
 * File queue handler.
 *
 * @private
 */
function _runFileQueue() {
  if (!settings) settings = require('./settings');
  const simultaneous = settings.get('load-simultaneously') || 10;

  if ((loading < simultaneous) && (fileQueue.length)) {
    loading++;
    fileQueue.shift()();
  }
}

/**
 * On end listener for readFile.
 *
 * @private
 * @param {string} filename           The filename.
 * @param {Array.<Buffer>} contents   The file contents as a series of buffers.
 * @param {Map} cache                 The file cache.
 */
function _readFileOnEnd(filename, contents, cache) {
  loading--;
  const data = Buffer.concat(contents);
  cache.set(filename, data);
  _fireReadFileCallbacks(filename, data);
  _runFileQueue();
}

/**
 * On error listener for readFile.
 *
 * @private
 * @param {string} filename     The filename.
 * @param {Error} error         The error fired.
 */
function _readFileOnError(filename, error) {
  loading--;
  _fireReadFileCallbacks(filename, error);
  _runFileQueue();
}

/**
 * Load a file synchronously using a cache.
 *
 * @public
 * @param {string} filename               The file to load.
 * @param {Map} cache                     The cache to use.
 * @param {null|string} [encoding=null]   The encoding to load as.
 * @returns {Promise.<Buffer|*>}          The load results.
 */
lodash.readFile = function readFile(filename, cache, encoding=null) {
  if (cache.has(filename)) return _handleFileInCache(filename, cache);
  _addReadCallbacks(filename, cache);
  fileQueue.push(()=>{
    const contents = [];
    fs.createReadStream(filename, {encoding})
      .on('data', chunk=>contents.push(chunk))
      .on('end', ()=>_readFileOnEnd(filename, contents, cache))
      .on('error', error=>_readFileOnError(filename, error))
  });
  _runFileQueue();
  return _handleFileInCache(filename, cache);
};

/**
 * Read a file synchronously using file cache.
 *
 * @param {string} filename               The filename to load.
 * @param {Map} cache                     The cache to use.
 * @param {null|strin} [encoding=null]    The encoding to use.
 * @returns {Buffer\*}                    The file contents as a buffer.
 */
lodash.readFileSync = function readFileSync(filename, cache, encoding=null) {
  if (cache.has(filename) && (cache.get(filename) !== true)) return cache.get(filename);
  const data = fs.readFileSync(filename, encoding);
  cache.set(filename, data);
  return data;
};

/**
 * Get the global require or local one if no global found.
 *
 * @public
 * @returns {Function}
 */
lodash.getRequire = function getRequire() {
  try {
    return __require;
  } catch(err) {
    return require;
  }
};

module.exports = lodash;
