/* jshint node: true */
'use strict';

const config = require('./config');
const getResolver = require('./resolver');
const tryModule = require('./try');
const {requireAsync, resolveModulePath} = require('./require');
const importDirectory = require('./import');



function promiseLibraryWrap(func) {
  if (config.has('Promise')) return config.get('Promise').resolve(func);
  return func;
}

requireAsync.resolve = promiseLibraryWrap(resolveModulePath);
requireAsync.getModule = (...params)=>{
  console.warn('Use of getModule() is deprecated, please use try() instead, it is exactly the same.')
  return promiseLibraryWrap(tryModule(...params));
};
requireAsync.try = promiseLibraryWrap(tryModule);
requireAsync.getResolver = promiseLibraryWrap(getResolver);
requireAsync.importDirectory = promiseLibraryWrap(importDirectory);
requireAsync.get = config.get.bind(config);
requireAsync.set = config.set.bind(config);
requireAsync.delete = config.delete.bind(config);


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});
/**
 * NodeJs module loading with an asynchronous flavour
 *
 * @module require-extra
 * @version 0.4.0
 * @type {function}
 */
module.exports = requireAsync;

try {
  __module.exports = module.exports;
} catch(err) {}
