/* jshint node: true */
'use strict';

const settings = require('./settings');
const Resolver = require('./resolver');
const tryModule = require('./try');
const {requireAsync, resolveModulePath, syncRequire} = require('./require');
const importDirectory = require('./import');
const {reflect, deprecated, promiseLibraryWrap} = require('./util');
const Module = require('./Module');
const workspaces = require('./workspaces');
const emitter = require('./events');
const cache = require('./cache');

const exported = function(...params){
  return requireAsync(...params);
};

exported.resolve = promiseLibraryWrap(resolveModulePath, settings);
exported.try = promiseLibraryWrap(tryModule, settings);
exported.getResolver = Resolver.getResolver;
exported.Resolver = Resolver;
exported.import = promiseLibraryWrap(importDirectory, settings);
exported.workspace = (id, value)=>{
  if (!value) return workspaces.exportedGet(id);
  return workspaces.set(id, value);
};
exported.cache = cache;
exported.sync = syncRequire;

reflect(settings, exported, ['get', 'delete', 'emit']);
reflect(emitter, exported, ['Error', 'Loaded', 'Event', 'Evaluated']);

exported.on = (...params)=>{
  const unsubscribe = emitter.on(...params);
  return Object.assign(unsubscribe, exported);
};
exported.once = (...params)=>{
  const unsubscribe = emitter.once(...params);
  return Object.assign(unsubscribe, exported);
};
exported.remove = (...params)=>{
  emitter.remove(...params);
  return exported;
};
exported.set = (...params)=>{
  settings.set(...params);
  return exported;
};


deprecated('getModule', 'try', exported);
deprecated('importDirectory', 'import', exported);

/**
 * NodeJs module loading with an asynchronous flavour
 *
 * @module require-extra
 * @version 0.4.0
 * @type {function}
 */
module.exports = exported;

try {
  __module.exports = module.exports;
} catch(err) {}
