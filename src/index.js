/* jshint node: true */
'use strict';

const {requireAsync, resolveModulePath, syncRequire} = require('./require');
const {reflect, deprecated, promiseLibraryWrap} = require('./util');
const Module = require('./Module');

const cache = require('./cache');

function _exportEmitter(exported) {
  const emitter = require('./events');
  reflect(
    emitter,
    exported, [
      'addListener', 'emit', 'eventNames', 'getMaxListeners', 'listenerCount', 'listeners', 'on', 'once',
      'prependListener', 'prependOnceListener', 'removeAllListeners', 'removeListener', 'setMaxListeners',
      'Error', 'Event', 'Loaded', 'Evaluated', 'Load', 'Evaluate'
    ]
  );

  return emitter;
}

function _exportSettings(exported) {
  const settings = require('./settings');
  reflect(settings, exported, ['get', 'delete']);
  exported.set = (...params)=>{
    settings.set(...params);
    return exported;
  };

  return settings;
}

function _exportWorspaces(exported) {
  const workspaces = require('./workspaces');
  exported.workspace = (id, value)=>{
    if (!value) return workspaces.exportedGet(id);
    return workspaces.set(id, value);
  };

  return workspaces;
}

function _exportRequireMethods(exported, settings) {
  const Resolver = require('./resolver');
  const tryModule = require('./try');
  const importDirectory = require('./import');

  exported.resolve = promiseLibraryWrap(resolveModulePath, settings);
  exported.try = promiseLibraryWrap(tryModule, settings);
  exported.getResolver = Resolver.getResolver;
  exported.Resolver = Resolver;
  exported.import = promiseLibraryWrap(importDirectory, settings);

  exported.cache = cache;
  exported.sync = syncRequire;
  exported.Module = Module;
}

function _deprecate(exported) {
  deprecated('getModule', 'try', exported);
  deprecated('importDirectory', 'import', exported);
}

function _init() {
  const exported = function(...params) {return requireAsync(...params);};
  const settings = _exportSettings(exported);

  _exportWorspaces(exported);
  _exportEmitter(exported);
  _exportRequireMethods(exported, settings);
  _deprecate(exported);

  return exported;
}

/**
 * NodeJs module loading with an asynchronous flavour
 *
 * @module require-extra
 * @version 0.4.0
 * @type {function}
 */
module.exports = _init();

try {
  __module.exports = module.exports;
} catch(err) {}
