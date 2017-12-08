'use strict';

const settings = require('./settings');
const path = require('path');
const Node_Module = require('module');
const cache = require('./cache');
const requireLike = require('require-like');
const {isString, createLopAddIterator} = require('./util');

/**
 * Get the parent of the module we are trying to create.  Use the given config object supplied to the constructor.
 *
 * @private
 * @param {Object} config     Constructor config.
 * @returns {Module}          The parent.
 */
function _getParent(config) {
  if (config.hasOwnProperty('parent')) {
    if (!isString(config.parent)) return config.parent;
    if (cache.has(config.parent)) return cache.get(config.parent);
  }

  return settings.get('parent').parent || settings.get('parent');
}

/**
 * Create a require function to pass into the module.
 *
 * @private
 * @param {Object} config     Module construction config.
 * @returns {Function}        The require function.
 */
function _getRequire(config) {
  if (!config.syncRequire && !config.resolveModulePath) return requireLike(config.filename);

  const _requireResolver = {
    basedir:config.basedir||path.dirname(config.filename),
    parent:config.filename,
    scope:config.scope,
    useSandbox:config.useSandbox,
    squashErrors:!!((config.resolver ||{}).squashErrors || config.squashErrors)
  };

  const requireX = require('./index');
  const _mergeResolver = resolver=>Object.assign({}, _requireResolver, resolver);
  const _getResolver = (params, resolverId=0)=>{
    if (isString(params[resolverId]) || Array.isArray(params[resolverId])) return _requireResolver;
    return _mergeResolver(params.shift());
  };

  return Object.assign(function(...params) {
    return config.syncRequire(_getResolver(params), ...params);
  }, requireX, {
    resolve: (...params)=>config.resolveModulePath(_getResolver(params), ...params),
    async: (...params)=>requireX(_getResolver(params), ...params),
    native: moduleId=>requireLike(config.filename)(moduleId),
    import: (dirPath, options, callback)=>requireX.import(dirPath, _mergeResolver(options), callback)
  });
}

/**
 * Module class that extends the node version so a construction object can be used.
 *
 * @class
 */
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

  /**
   * Ensure we look like native js module from node.
   *
   * @static
   * @param {Object} instance     The Object instance we are testing.
   * @returns {boolean}           Is given a instance of Module?
   */
  static [Symbol.hasInstance](instance) {
    return ((instance instanceof Module) || (instance instanceof Node_Module));
  }

  /**
   * If we want the type, return the native node one so we look the same.
   *
   * @static
   * @returns {Module}      NodeJs Module class.
   */
  static get [Symbol.species]() {
    return Node_Module;
  }
}

module.exports = Module;