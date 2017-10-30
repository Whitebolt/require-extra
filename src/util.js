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
util.makeArray = function makeArray(value) {
  if (value === undefined) return [];
  if (value instanceof Set) return [...value];
  return util.castArray(value);
};

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

util.promiseLibraryWrap = function promiseLibraryWrap(func, config) {
  if (config.has('Promise')) return config.get('Promise').resolve(func);
  return func;
};

util.deprecated = function deprecated(from, to, exported) {
  exported[from] = (...params)=>{
    console.warn(`Use of ${from} is deprecated, please use ${to}() instead, it is exactly the same.`);
    return exported[to](...params);
  };
};

util.reflect = function reflect(from, to, properties) {
  properties.forEach(property=>to[property] = from[property].bind(from));
};

util.readDir = util.promisify(fs.readdir);
util.readFile = util.promisify(fs.readFile);

module.exports = util;
