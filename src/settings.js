'use strict';

const config = require('../package.json').config;
const {uniq, makeArray, isObject} = require('./util');

let singleton;

const getterOverrides = {

};

const setterOverrides = {
  extensions: value=>uniq(makeArray(value))
};

/**
 * Settings class for this module.
 *
 * @singleton
 * @extends Map
 */
class RequireExtraSettings extends Map {
  constructor(...params) {
    if (singleton) return singleton;
    super(...params);
    singleton = this;
    Object.keys(config).forEach(key=>this.set(key, config[key]));
    this.set('resolveModule', require('resolve'));
  }

  /**
   * Add a value to a given key ensuring the new array has only unique items.
   *
   * @param {string} key    Key to add to.
   * @param {*} value       Value to add.
   * @returns {Array}       The new array.
   */
  add(key, value) {
    return this.set(key, uniq([...makeArray(this.get(key)), ...makeArray(value)]));
  }

  /**
   * Get a given setting.  Use overrides to tweak results on certain settings.
   *
   * @param {string} key      Key to get.
   * @returns {*}
   */
  get(key) {
    let value = super.get(key);
    if (getterOverrides.hasOwnProperty(key)) return super.set(key, getterOverrides[key](value));
    if ((key === 'resolver') && !value) {
      const Resolver = require('./resolver');
      value = new Resolver();
      this.set('resolver', value);
    }
    return value;
  }

  /**
   * Set a given setting.  Use overrides to parse values before settning.
   *
   * @param {string} key    Key to set.
   * @param {*} value       Value to set it to.
   * @returns {boolean}     Did it set.
   */
  set(key, value) {
    if (isObject(key)) {
      Object.keys(key).forEach(_key=>this.set(_key, key[_key]));
      return this;
    } else {
      if (setterOverrides.hasOwnProperty(key)) return super.set(key, setterOverrides[key](value));
      super.set(key, value);
      return this;
    }
  }
}

module.exports = new RequireExtraSettings();