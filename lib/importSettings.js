'use strict';

// @note We are avoiding ES6 here.

function loadConfig(id, copyProps, defaultPropValues) {
  function getPackageData(filename) {
    filename = filename || 'package.json';
    try {
      return require(__cwd + './' + filename);
    } catch(err) {
      return {};
    }
  }

  function assign() {
    arguments[0] = arguments[0] || {};

    for (var n=1; n<arguments.length; n++) {
      for (var key in arguments[n]) {
        if (arguments[n].hasOwnProperty(key)) arguments[0][key] = arguments[n][key];
      }
    }
    return arguments[0];
  }

  function pick(from, picks, defaults) {
    picks = picks || [];
    defaults = defaults || {};

    var obj = {};
    for (var n=0; n<picks.length; n++) obj[picks[n]] = from[picks[n]] || defaults[picks[n]];
    return obj;
  }

  global.__cwd = process.cwd() + '/';
  var packageData = getPackageData();
  var local = getPackageData('local.json');

  global[id+'Settings'] = assign(
    packageData[id],
    pick(packageData, copyProps, defaultPropValues),
    {nodeVersion: parseFloat(process.versions.node.split('.').slice(0, 2).join('.'))},
    local
  );
}

module.exports = loadConfig;