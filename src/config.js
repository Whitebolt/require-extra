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
    this.set('resolver', require('resolve'));
  }

  add(key, value) {
    return this.set(key, uniq([...makeArray(this.get(key)), ...makeArray(value)]));
  }

  get(key) {
    if (getterOverrides.hasOwnProperty(key)) return super.set(key, getterOverrides[key](value));
    return super.get(key);
  }

  set(key, value) {
    if (setterOverrides.hasOwnProperty(key)) return super.set(key, setterOverrides[key](value));
    return super.set(key, value);
  }
}

module.exports = new RequireExtraSettings();