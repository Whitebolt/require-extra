'use strict';

// @note We are avoiding ES6 here.

var path = require('path');

/**
 * Load config properties from package.json of module.
 *
 * @param {string} id                   Id in package.json to grab from.
 * @param {Array} copyProps             Properties to get.
 * @param {Object} defaultPropValues    Default values to apply.
 * @returns {Object}                    The config.
 */
function loadConfig(id, copyProps, defaultPropValues) {
  var cwd = path.normalize(__dirname + '/../');

  /**
   * Get the package file without error-ing on fail,
   *
   * @param {string} [filename='package.json']    Package source name.
   * @returns {Object}                            The package file.
   */
  function getPackageData(filename) {
    filename = filename || 'package.json';
    try {
      return require(cwd + './' + filename);
    } catch(err) {
      return {};
    }
  }

  /**
   * A local version of Object.assign() for old node versions.
   *
   * @param {Array} [...=[{}]]     Objects to assign (in order).
   * @returns {Object}
   */
  function assign() {
    arguments[0] = arguments[0] || {};

    for (var n=1; n<arguments.length; n++) {
      for (var key in arguments[n]) {
        if (arguments[n].hasOwnProperty(key)) arguments[0][key] = arguments[n][key];
      }
    }
    return arguments[0];
  }

  /**
   * Pick the given properties from the given object, returning a new object.
   *
   * @param {Object} from             Object to take from.
   * @param {Array} [picks=[]]        Properties to pick.
   * @param {Object} [defaults={}]    Defaults to apply.
   * @returns {Object}
   */
  function pick(from, picks, defaults) {
    picks = picks || [];
    defaults = defaults || {};

    var obj = {};
    for (var n=0; n<picks.length; n++) obj[picks[n]] = from[picks[n]] || defaults[picks[n]];
    return obj;
  }

  var packageData = getPackageData();
  var local = getPackageData('local.json');

  var exported = assign(
    packageData[id],
    pick(packageData, copyProps, defaultPropValues),
    {nodeVersion: parseFloat(process.versions.node.split('.').slice(0, 2).join('.'))},
    local,
    {cwd: cwd}
  );

  return exported;
}

module.exports = loadConfig;