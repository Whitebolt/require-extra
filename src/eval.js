'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const requireLike = require('require-like');
const {isString, isObject, isBoolean} = require('./util');
const settings = require('./config');

function _createConfig(content, filename, scope, includeGlobals) {
  const config = {content, filename, scope, includeGlobals};
  if (!isString(filename)) {
    if (isObject(filename)) {
      Object.assign(config, {includeGlobals:scope, scope:filename, filename:null});
    } else if (isBoolean(filename)) {
      Object.assign(config, {includeGlobals:filename, scope:{}, filename:null});
    }
  }

  config.content = isBuffer(config.content)?config.content.toString():config.content;
  config.filename =  config.filename || module.parent.filename;

  return config;
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

  if (config.includeGlobals) Object.assign(sandbox, global, {require:requireLike(config.filename)});
  if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  Object.assign(sandbox, {
    exports, module: {
      exports: exports,
      filename: config.filename,
      id: config.filename,
      parent: settings.get('parent').parent || settings.get('parent'),
      require: sandbox.require || requireLike(config.filename)
    },
    __filename: config.filename,
    __dirname: path.dirname(config.filename)
  });

  return createProxy(sandbox);
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

function evaluate(content, filename, scope, includeGlobals) {
  const config = _createConfig(content, filename, scope, includeGlobals);
  const options = _createOptions(config);
  const sandbox = _createSandbox(config);
  const script = _createScript(config, options);

  script.runInNewContext(sandbox, options);

  return sandbox.module;
}


module.exports = evaluate;