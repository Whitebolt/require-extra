'use strict';

var fs = require('fs');
var semvar = require('semver');

function getBuildFiles(root) {
  return fs.readdirSync(root).sort(semvarSort);
}

function getVersion(filename) {
  return filename.replace('.js', '');
}

function semvarSort(a, b) {
  var _a = getVersion(a);
  var _b = getVersion(b);
  return (semvar.gt(_a, _b)? 1 : (semvar.lt(_a, _b) ? - 1 : 0));
}

function getMyVersion(buildDir) {
  var builds = getBuildFiles(buildDir);
  var chosen = builds[0];

  for (var n=0; n<builds.length; n++) {
    if (semvar.satisfies(getVersion(builds[n]), '<=' + process.versions.node)) chosen = builds[n];
  }

  return require(buildDir + '/' + chosen);
}

module.exports = getMyVersion;
