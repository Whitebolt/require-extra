'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const requireLike = require('require-like');
const {isString, isObject, createLopAddIterator} = require('./util');
const settings = require('./config');
const semvar = require('semver');
const cache = require('./cache');
const Module = require('module');

const { r, g, b, w, c, m, y, k } = [
  ['r', 1], ['g', 2], ['b', 4], ['w', 7],
  ['c', 6], ['m', 5], ['y', 3], ['k', 0]
].reduce((cols, col) => ({
  ...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`
}), {});

const proxiedGlobal = (semvar.gt(process.versions.node, '8.3.0'));


function _parseConfig(config) {
  const _config = Object.assign({
    filename:module.parent.filename,
    scope:{},
    includeGlobals:false,
    proxyGlobal:true
  }, config);

  config.content = isBuffer(config.content)?config.content.toString():config.content;

  return _config;
}

function createProxy(sandbox) {
  return new Proxy(sandbox, {
    get: function(target, property, receiver) {
      //if ((property === 'exports') && !(property in target)) return sandbox.module.exports;
      if (property === 'global') return global;
      if (property in target) return Reflect.get(target, property, receiver);
      return Reflect.get(global, property, receiver);
    },
    has: function(target, property) {
      //if (property === 'exports') return true;
      return Reflect.has(target, property) || Reflect.has(global, property);
    },
    set: function(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    }
  });
}

function _getParent(config) {
  if (config.hasOwnProperty('parent')) {
    if (!isString(config.parent)) return config.parent;
    if (cache.has(config.parent)) return cache.get(config.parent);
  }

  return settings.get('parent').parent || settings.get('parent');
}

function _createSandbox(config) {
  let sandbox = {};

  if (config.includeGlobals && (!proxiedGlobal || !config.proxyGlobal)) Object.assign(sandbox, global);
  if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  return ((proxiedGlobal && config.proxyGlobal)?createProxy(sandbox):sandbox);
}

function _getRequire(config) {
  if (!config.syncRequire && !config.resolveModulePath) return requireLike(config.filename);

  const _require = function(moduleId) {
    return config.syncRequire({basedir:path.dirname(config.filename), parent:config.filename}, moduleId);
  };
  _require.resolve = function(moduleId) {
    return config.resolveModulePath({basedir:path.dirname(config.filename)}, moduleId);
  };
  _require.cache = cache.source;

  return _require;
}

function _createOptions(config) {
  return {
    filename:config.filename,
    displayErrors:true,
    timeout: 20*1000
  };
}

function _createScript(config, options) {
  if (!isString(config.content)) return config.content;
  const stringScript = Module.wrap(config.content.replace(/^\#\!.*/, ''));
  return new vm.Script(stringScript, options);
}

function _runScript(config, script, sandbox, options) {
  const parent = _getParent(config);
  const module = new Module(config.filename, parent);
  const __filename = module.filename = config.filename;
  const __dirname = path.dirname(config.filename);
  const require = module.require = _getRequire(config); //requireLike(config.filename);

  module.paths = [...createLopAddIterator(__dirname, config.moduleDirectory || 'node_modules')];
  module.loaded = false;

  cache.set(config.filename, module);

  script.runInNewContext(sandbox, options)(module.exports, require, module, __filename, __dirname);

  module.loaded = true;

  return module;
}

function evaluate(config) {
  const time = process.hrtime();
  const _config = _parseConfig(config);
  const options = _createOptions(_config);
  const sandbox = _createSandbox(_config);
  const script = _createScript(_config, options);
  const module = _runScript(config, script, sandbox, options);
  const diff = process.hrtime(time);
  const ms = parseInt((diff[0] * 1000) + (diff[1] / 1000000), 10);

  console.log(`${cache.size} ${c(ms+'ms')} ${y(config.filename)}`);

  return module;
}


module.exports = evaluate;