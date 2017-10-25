'use strict';

const Promise = require('bluebird');  // jshint ignore:line
const fs = require('fs');
const util = require('lodash-provider');

util.readDir = Promise.promisify(fs.readdir);
util.readFile = Promise.promisify(fs.readFile);

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

module.exports = util;
