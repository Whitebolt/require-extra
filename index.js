'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var _eval = require('eval');
var _ = require('lodash');
var resolver = new (require('async-resolve'))();

var readFile = Promise.promisify(fs.readFile);

/**
 * Resolve a module path starting from current directory via returned promise.
 *
 * @private
 * @param {string} moduleName       Module name or path (same format as supplied to require()).
 * @returns {Promise}
 */
function resolveModulePath(moduleName){
  return new Promise(function(resolve, reject){
    resolver.resolve(moduleName, __dirname, function(err, modulePath){
      if(err){
        return reject(err);
      }

      return resolve(modulePath);
    });
  });
}



/**
 * Return given value as array.  If already an array, just return as-is.
 * Undefined will return an empty array.
 *
 * @private
 * @param {Array|mixed} ary     Value to return as an array
 * @returns {Array}
 */
function makeArray(ary){
  return ((ary === undefined)?[]:(_.isArray(ary)?ary:[ary]));
}

/**
 * Load a module or return a default value.  Can take an array to try.  Will load module asychronously.
 *
 * @public
 * @param {string|Array} modulePath             Module path or array of paths.
 * @param {mixed} [defaultReturnValue=false]    The default value to return if module load fails.
 * @returns {Promise}
 */
function getModule(modulePath, defaultReturnValue){
  if(modulePath){
    modulePath = makeArray(modulePath);
    return requireAsync(modulePath.shift()).catch(function(error){
      if(modulePath.length){
        return requireAsync(modulePath);
      }

      return Promise.resolve(defaultReturnValue || false);
    });
  }

  return Promise.resolve(defaultReturnValue || false);
}

/**
 * Read text from a file and handle any errors.
 *
 * @private
 * @param {string} fileName
 * @returns {string|undefined}
 */
function loadModuleText(fileName){
  return readFile(fileName, 'utf8').then(function(moduleText){
    return moduleText;
  });
}

/**
 * Evaluate module text in similar fashion to require evaluations.
 *
 * @private
 * @param {string} modulePath   The path of the evaluated module.
 * @param {string} moduleText   The text content of the module.
 * @returns {mixed}
 */
function evalModuleText(modulePath, moduleText){
  return ((moduleText !== undefined)?_eval(moduleText, modulePath, {}, true):undefined);
}

/**
 * Load and evaluate a module returning undefined to promise resolve on failure.
 *
 * @private
 * @param {string} modulePath   The path of the evaluated module.
 * @param {string} moduleText   The text content of the module.
 * @returns {mixed}
 */
function loadModule(modulePath){
  return loadModuleText(modulePath).then(function(moduleText){
    return evalModuleText(modulePath, moduleText);
  });
}


/**
 * Load a module asychronously, this is an async version of require().
 *
 * @public
 * @param {string} moduleName     Module name or path, same format as for require().
 * @param {function} [callback]   Node-style callback to use instead of (or as well as) returned promise.
 * @returns {Promise}             Promise, resolved with the module or undefined.
 */
function requireAsync(moduleName, callback){
  var async = resolveModulePath(moduleName).then(function(modulePath){
    return loadModule(require.resolve(modulePath));
  }, function(error){
    return Promise.reject(error);
  });

  if(callback){
    async.nodeify(callback);
  }

  return async;
}

module.exports = {
  getModule: getModule,
  require: requireAsync
}