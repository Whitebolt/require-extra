/* jshint node: true */
'use strict';

const config = require('./config');
const Resolver = require('./resolver');
const tryModule = require('./try');
const {requireAsync, resolveModulePath} = require('./require');
const importDirectory = require('./import');
const {reflect, deprecated, promiseLibraryWrap} = require('./util');

const exported = function(...params){
  return requireAsync(...params);
};

exported.resolve = promiseLibraryWrap(resolveModulePath, config);
exported.try = promiseLibraryWrap(tryModule, config);
exported.getResolver = Resolver.getResolver;
exported.Resolver = Resolver;
exported.import = promiseLibraryWrap(importDirectory, config);

reflect(config, exported, ['get', 'set', 'delete']);
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
