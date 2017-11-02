'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const requireLike = require('require-like');
const {isString, isObject} = require('./util');
const settings = require('./config');
const semvar = require('semver');
const cache = require('./cache');

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
      if (property === 'exports') return sandbox.module.exports;
      if (property === 'global') return global;
      if (property in target) return Reflect.get(target, property, receiver);
      return Reflect.get(global, property, receiver);
    },
    has: function(target, property) {
      if (property === 'exports') return true;
      return Reflect.has(target, property) || Reflect.has(global, property);
    },
    set: function(target, property, value, receiver) {
      if (property === 'exports') {
        sandbox.module.exports = value;
        return true;
        //return Reflect.set(target.module, property, value, receiver);
      }
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
  let exports = {};
  const sandbox = {};
  const parent = _getParent(config);

  if (config.includeGlobals && (!proxiedGlobal || !config.proxyGlobal)) Object.assign(sandbox, global);
  if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  Object.assign(sandbox, {
    exports, module: {
      exports,
      filename: config.filename,
      id: config.filename,
      parent,
      loaded: false,
      children:[],
      paths:[]
    },
    __filename: config.filename,
    __dirname: path.dirname(config.filename)
  });
  sandbox.require = sandbox.module.require = _getRequire(config); //requireLike(config.filename);

  if (parent && parent.children && parent.children.push) parent.children.push(sandbox.module);


  return ((proxiedGlobal && config.proxyGlobal)?createProxy(sandbox):sandbox);
}

function _getRequire(config) {
  if (!config.syncRequire && !config.resolveModulePath) return requireLike(config.filename);

  const _require = function(moduleId) {
    //console.log('require: ', moduleId, ' in:', config.filename);
    return config.syncRequire({basedir:path.dirname(config.filename), parent:config.filename}, moduleId);
  };
  _require.resolve = function(moduleId) {
    //console.log(`${g('resolve:')} ${g(moduleId)} in ${config.filename}'}`);
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
  const stringScript = config.content.replace(/^\#\!.*/, '');
  return new vm.Script(stringScript, options);
}

function evaluate(config) {
  const time = process.hrtime();
  const _config = _parseConfig(config);
  const options = _createOptions(_config);
  const sandbox = _createSandbox(_config);

  cache.set(config.filename, sandbox.module);

  const script = _createScript(_config, options);

  //try {
    script.runInNewContext(sandbox, options);
    const diff = process.hrtime(time);
    const ms = parseInt((diff[0] * 1000) + (diff[1] / 1000000), 10);
    //console.log(`${cache.size} ${c(ms+'ms')} ${y(config.filename)}`);
  /*} catch (err) {
    console.log(`Failed in: ${r(config.filename)}
      Called From: ${config.parent}
      ${r(err)}
      ${r(err.stack)}
    `);
    throw err;
  }*/

  sandbox.module.loaded = true;

  return sandbox.module;
}


module.exports = evaluate;