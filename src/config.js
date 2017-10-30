'use strict';

const config = require('../package.json').config;
const {uniq, makeArray} = require('./util');

let singleton;

const getterOverrides = {

};

const setterOverrides = {
  extensions: value=>uniq(makeArray(value))
};

/**
 * @singleton
 * @extends Map
 */
class RequireExtraSettings extends Map {
  constructor(...params) {
    if (singleton) return singleton;
    super(...params);
    singleton = this;
    Object.keys(config).forEach(key=>this.set(key, config[key]));
    this.set('resolve-module', require('resolve'));
  }

  add(key, value) {
    return this.set(key, uniq([...makeArray(this.get(key)), ...makeArray(value)]));
  }

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

  set(key, value) {
    if (setterOverrides.hasOwnProperty(key)) return super.set(key, setterOverrides[key](value));
    return super.set(key, value);
  }
}

module.exports = new RequireExtraSettings();