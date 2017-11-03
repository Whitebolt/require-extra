'use strict';

// @note We are avoiding ES6 here.

var fs = require('fs');
var semvar = require('semver');


/**
 * Get list of built version files in order in a given directory.
 *
 * @param {string} root         The path to search.
 * @returns {Array.<string>}    Version files.
 */
function getBuildFiles(root) {
  return fs.readdirSync(root).sort(semvarSort);
}

/**
 * Get the node version file is for.
 *
 * @param {string} filename     File we are extracting version from.
 * @returns {string}            The version.
 */
function getVersion(filename) {
  return filename.replace('.js', '');
}

/**
 * Sorter to sort according to semvar sequence. For use in Array.prototye.sort().
 *
 * @param {string} a      First sort item.
 * @param {string} b      Second sort item.
 * @returns {number}      How to sort, returns 1,0 or -1.
 */
function semvarSort(a, b) {
  var _a = getVersion(a);
  var _b = getVersion(b);
  return (semvar.gt(_a, _b)? 1 : (semvar.lt(_a, _b) ? - 1 : 0));
}

/**
 * Get current node version a retrieve built file for that version.
 *
 * @param {string} buildDir   Where build files are located.
 * @returns {string}          The build file to use.
 */
function getMyVersion(buildDir) {
  var builds = getBuildFiles(buildDir);
  var chosen = builds[0];

  for (var n=0; n<builds.length; n++) {
    if (semvar.satisfies(getVersion(builds[n]), '<=' + process.versions.node)) chosen = builds[n];
  }

  return require(buildDir + '/' + chosen);
}

module.exports = getMyVersion;
