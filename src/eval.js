'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const requireLike = require('require-like');
const {isString, isObject} = require('./util');
const settings = require('./config');
const semvar = require('semver');

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
      if (property === 'global') return global;
      if (property in target) return Reflect.get(target, property, receiver);
      return Reflect.get(global, property, receiver);
    },
    has: function(target, property) {
      return Reflect.has(target, property) || Reflect.has(global, property);
    }
  });
}

function _createSandbox(config) {
  let exports = {};
  const sandbox = {};

  if (config.includeGlobals && (!proxiedGlobal || !config.proxyGlobal)) Object.assign(sandbox, global);
  if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  Object.assign(sandbox, {
    exports, module: {
      exports: exports,
      filename: config.filename,
      id: config.filename,
      parent: settings.get('parent').parent || settings.get('parent')
    },
    __filename: config.filename,
    __dirname: path.dirname(config.filename)
  });
  sandbox.require = sandbox.module.require = requireLike(config.filename);

  return ((proxiedGlobal && config.proxyGlobal)?createProxy(sandbox):sandbox);
}

function _createOptions(config) {
  return {
    filename:config.filename,
    displayErrors:false
  };
}

function _createScript(config, options) {
  if (!isString(config.content)) return config.content;
  const stringScript = config.content.replace(/^\#\!.*/, '');
  return new vm.Script(stringScript, options);
}

function evaluate(config) {
  const _config = _parseConfig(config);
  const options = _createOptions(_config);
  const sandbox = _createSandbox(_config);
  const script = _createScript(_config, options);

  script.runInNewContext(sandbox, options);

  return sandbox.module;
}


module.exports = evaluate;