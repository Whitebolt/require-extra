'use strict';

const Module = require('module');
const {getRequire} = require('./util');
const fs = require('fs');
const settings = require('./settings');
const refs = new Map();
const refLookup = new Map();

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

function getRef(property) {
  if (!settings.get('followHardLinks')) return;
  try {
    if (refLookup.has(property)) return refLookup.get(property);
    const stats = fs.statSync(property);
    const ref = `${stats.dev}:${stats.ino}`;
    refLookup.set(property, ref);
    return ref;
  } catch(err) {
    console.log(err)
  }
}

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
    let module = globalCache[property];
    if (!!module) return module;
    const ref = getRef(property);
    if (refs && refs.has(ref)) {
      const otherProp = refs.get(ref);
      module = this.get(otherProp);
      if (!!module) return module;
    }
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
    const ref = getRef(property);
    if (ref) refs.set(ref, property);
    return true;
  }

  /**
   * Does the global module cache have the given module?
   *
   * @param {string} property     Module to check.
   * @returns {boolean}           Is it there?
   */
  has(property) {
    if (property in globalCache) return true;
    const ref = getRef(property);
    if (ref && refs.has(ref)) return true;
    return false;
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
      const ref = getRef(property);
      if (ref) return refs.delete(ref);
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