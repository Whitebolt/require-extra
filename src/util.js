'use strict';

const fs = require('fs');
const path = require('path');
const callsite = require('callsite');
const util = require('lodash-provider');
const _util = require('util');


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
util.makeArray = function makeArray(value, defaultValue) {
  if (value === undefined) return [];
  if (value instanceof Set) return [...value];
  return util.castArray(value);
};

/**
 * Ponyfill for util.promisify if not available.
 *
 * @param {Function} func     Function to promisify.
 * @returns {Function}        Promisified function.
 */
util.promisify = function promisify(func) {
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
util.getCallingFileName = function getCallingFileName() {
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
util.getCallingDir = function getCallingDir(resolveTo) {
  const filename = util.getCallingFileName();
  if (filename) return path.resolve(...[path.dirname(filename), ...util.makeArray(resolveTo)]);
};

/**
 * Get all the property names (including inherited) of the given object.
 *
 * @public
 * @param {Object} obj		The object to get properties for.
 * @returns {Set}			A set of all the property names.
 */
util.getAllPropertyNames = function getAllPropertyNames(obj) {
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
util.promiseLibraryWrap = function promiseLibraryWrap(func, settings) {
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
util.deprecated = function deprecated(from, to, exported) {
  exported[from] = (...params)=>{
    console.warn(`Use of ${from} is deprecated, please use ${to}() instead, it is exactly the same. This being used in ${util.getCallingFileName()}`);
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
util.reflect = function reflect(from, to, methods) {
  util.makeArray(methods).forEach(property=>{
    to[property] = (util.isFunction(from[property])?from[property].bind(from):from[property]);
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
util.lopAdd = function lopAdd(path, addition, first=false) {
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
util.createLopAddIterator = function* createLopAddIterator(path, addition) {
  path = util.lopAdd(path, addition, true);
  while (path !== `/${addition}`) {
    yield path;
    path = util.lopAdd(path, addition);
  }
  yield path;
};

util.readDir = util.promisify(fs.readdir);

const readFileCallbacks = new Map();

util.readFile = function readFile(filepath, encoding, cache) {
  return new Promise((resolve, reject)=>{
    if (cache.has(filepath)) {
      if (cache.get(filepath) !== true) {
        return cache.get(filepath);
      }
      readFileCallbacks.get(filepath).add((err, data)=>{
        if (err) return reject(err);
        return resolve(data);
      });
    } else {
      const callbacks = new Set();
      cache.set(filepath, true);
      readFileCallbacks.set(filepath, callbacks);
      const contents = [];
      fs.createReadStream(filepath, {encoding:null}).on('data', chunk=>{
        contents.push(chunk);
      }).on('end', ()=>{
        const data = Buffer.concat(contents).toString();
        cache.set(filepath, data);
        if (callbacks.size) callbacks.forEach(callback=>callback(null, data));
        callbacks.clear();
        readFileCallbacks.delete(filepath);
        resolve(data);
      }).on('error', error=>{
        if (callbacks.size) callbacks.forEach(callback=>callback(error, null));
        callbacks.clear();
        readFileCallbacks.delete(filepath);
        reject(error)
      });
    }
  });
};

util.readFileSync = function readFileSync(filepath, encoding, cache) {
  if (cache.has(filepath) && (cache.get(filepath) !== true)) return cache.get(filepath);
  const data = fs.readFileSync(filepath, encoding);
  cache.set(filepath, data);
  return data;
};

util.getRequire = function getRequire() {
  try {
    return __require;
  } catch(err) {
    return require;
  }
};

module.exports = util;
