'use strict';

const path = require('path');
const callsite = require('callsite');
const _util = require('util');
const lodash = require('lodash');

Object.assign(
  lodash,
  lodash.pick(require('./fs'), [
    'lstat',
    'stat',
    'statSync',
    'readDir',
    'readFile',
    'readFileSync',
    'isFile',
    'isFileSync',
    'isDirectory',
    'isDirectorySync'
  ])
);


/**
 * Turn the given value into an array.  If it is already an array then return it; if it is a set then convert to an
 * array; and if neither then return as the first item in an array. The purpose of this function is for function
 * or method parameters where they can be either a array or not.  You can use this to ensure you are working on
 * an array.
 *
 * @public
 * @param {Array|Set|*} value		Value to return or convert.
 * @returns {Array}					    The converted value (or original if already an array).
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
