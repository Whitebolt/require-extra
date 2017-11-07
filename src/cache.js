'use strict';

const Module = require('module');
const {getRequire} = require('./util');

/**
 * Reference to the global module cache.  If not found return a new object created from a null prototype.
 *
 * @type {Object}
 */
const globalCache = (()=>{
  try {
    return getRequire().cache;
  } catch (err) {
    return Object.create(null);
  }
})();

/**
 * An interface to the global module cache.
 *
 * @class
 */
class Cache {
  /**
   * Get a module from the global module cache.
   *
   * @param {string} property     Module path to get for.
   */
  get(property) {
    return globalCache[property];
  }

  /**
   * Set a module in the global module cache.
   *
   * @param {string} property     Module to set
   * @param {Module} value        Module value.
   * @returns {boolean}           Did it set?
   */
  set(property, value) {
    if (!(value instanceof Module)) throw new TypeError('Cannot add a non-module to the cache.');
    globalCache[property] = value;
    return true;
  }

  /**
   * Does the global module cache have the given module?
   *
   * @param {string} property     Module to check.
   * @returns {boolean}           Is it there?
   */
  has(property) {
    return (property in globalCache);
  }

  /**
   * Delete a given module from the cache.
   *
   * @param {string} property   Module to delete.
   * @returns {boolean}         Was anything deleted?
   */
  delete(property) {
    if (this.has(property)) {
      delete globalCache[property];
      return true;
    }
    return false;
  }

  /**
   * Clear the cache.
   *
   * @returns {boolean}     Did it clear?
   */
  clear() {
    Object.keys(globalCache).forEach(property=>this.delete(property));
    return true;
  }

  /**
   * Current cache size.
   *
   * @returns {Number}
   */
  get size() {
    return Object.keys(globalCache).length;
  }

  /**
   * Return a reference to the global cache (or the one we are using if it was not found).
   */
  get source() {
    return globalCache;
  }
}

module.exports = new Cache();