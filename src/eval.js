'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const {isString, makeArray} = require('./util');
const semvar = require('semver');
const cache = require('./cache');
const Module = require('./Module');

const workspaces = new Map();

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
    proxyGlobal:true,
    workspace: ['default']
  }, config);

  config.content = isBuffer(config.content)?config.content.toString():config.content;

  return _config;
}

function _createProxy(config) {
  const _workspaces = makeArray(config.workspace || ['default']).map(workspaceId=>{
    if (!workspaces.has(workspaceId)) workspaces.set(workspaceId, {});
    return workspaces.get(workspaceId);
  });

  return new Proxy(global, {
    get: function(target, property, receiver) {
      if (property === 'global') return global;
      for (let n=0; n<_workspaces.length; n++) {
        if (property in _workspaces[n]) return Reflect.get(_workspaces[n], property, receiver);
      }
      return Reflect.get(target, property, receiver);
    },
    has: function(target, property) {
      for (let n=0; n<_workspaces.length; n++) {
        if (property in _workspaces[n]) return true;
      }
      return Reflect.has(target, property);
    },
    set: function(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    }
  });
}

function _createSandbox(config) {
  const workspaceId = makeArray(config.workspace || []).join('+');

  if (proxiedGlobal && proxiedGlobal) {
    if (!workspaces.has(workspaceId)) workspaces.set(workspaceId, vm.createContext(_createProxy(config)));
    return workspaces.get(workspaceId);
  }

  const sandbox = {};
  if (config.includeGlobals && (!proxiedGlobal || !config.proxyGlobal)) Object.assign(sandbox, global);
  //if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  return vm.createContext(sandbox);
}

function _createOptions(config) {
  return {
    filename:config.filename,
    displayErrors:true,
    timeout: config.timeout || 20*1000
  };
}

function _createScript(config, options) {
  if (!isString(config.content)) return config.content;
  const stringScript = Module.wrap(config.content.replace(/^\#\!.*/, ''));
  return new vm.Script(stringScript, options);
}

function _runScript(config, script, sandbox, options) {
  const module = new Module(config);

  script.runInContext(sandbox, options)(
    module.exports,
    module.require,
    module,
    module.filename,
    config.basedir || path.dirname(module.filename)
  );

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