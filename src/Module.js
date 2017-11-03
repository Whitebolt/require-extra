'use strict';

const settings = require('./config');
const path = require('path');
const Node_Module = require('module');
const cache = require('./cache');
const requireLike = require('require-like');
const {isString, createLopAddIterator} = require('./util');


function _getParent(config) {
  if (config.hasOwnProperty('parent')) {
    if (!isString(config.parent)) return config.parent;
    if (cache.has(config.parent)) return cache.get(config.parent);
  }

  return settings.get('parent').parent || settings.get('parent');
}

function _getRequire(config) {
  if (!config.syncRequire && !config.resolveModulePath) return requireLike(config.filename);

  const basedir = config.basedir||path.dirname(config.filename);
  const _resolveResolver = {basedir};
  const _requireResolver = {basedir, parent:config.filename};

  const _require = function(moduleId) {
    return config.syncRequire(_requireResolver, moduleId);
  };
  _require.resolve = function(moduleId) {
    return config.resolveModulePath(_resolveResolver, moduleId);
  };
  _require.cache = cache.source;

  return _require;
}

class Module extends Node_Module {
  constructor(config) {
    const parent = _getParent(config);
    super(config.filename, parent);

    this.filename = config.filename;
    this.require = _getRequire(config);
    this.paths = [...createLopAddIterator(__dirname, config.moduleDirectory || 'node_modules')];
    this.loaded = false;

    cache.set(this.filename, this);
  }

  static [Symbol.hasInstance](instance) {
    return ((instance instanceof Module) || (instance instanceof Node_Module));
  }

  static get [Symbol.species]() {
    return Node_Module;
  }
}

module.exports = Module;