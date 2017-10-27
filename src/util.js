'use strict';

const fs = require('fs');
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

util.readDir = util.promisify(fs.readdir);
util.readFile = util.promisify(fs.readFile);

module.exports = util;
