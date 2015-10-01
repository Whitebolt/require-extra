'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var _eval = require('eval');
var _ = require('lodash');

var readFile = Promise.promisify(fs.readFile);


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
 * @private
 * @param {string|Array} modulePath             Module path or array of paths.
 * @param {mixed} [defaultReturnValue=false]    The default value to return if module load fails.
 * @returns {Promise}
 */
function getModule(modulePath, defaultReturnValue){
  if(modulePath){
    modulePath = makeArray(modulePath);
    return requireAsync(modulePath.shift()).then(function(module){
      if((module === undefined) && (modulePath.length)){
        return requireAsync(modulePath);
      }

      return module;
    })
  }

  return Promise.resolve(defaultReturnValue || false);
}


/**
 * Load a module asychronously, this is an async version of require().
 *
 * @private
 * @param {string} moduleName     Module name or path, same format as for require().
 * @returns {Promise}             Promise, resolved with the module or undefined.
 */
function requireAsync(moduleName){
  try{
    var modulePath = require.resolve(moduleName);

    return readFile(modulePath, 'utf8').then(function(moduleText){
      return _eval(moduleText, modulePath, {}, true);
    }, function(error){
      return undefined;
    }).catch(function(error){
      return undefined;
    });
  }catch(error){
  }

  return Promise.resolve(undefined);
}

module.exports = {
  getModule: getModule,
  require: requireAsync
}