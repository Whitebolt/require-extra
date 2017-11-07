'use strict';

var semvar = require('semver');
var requireX;
if (semvar.lt('7.5.99', process.versions.node)) {
  requireX = require('./src/');
  requireX.set('parent', module.parent);
} else {
  var settings = require('./src/importSettings')('gulp');
  requireX = require('./src/versionLoader')(settings.cwd + settings.build);
}

module.exports = requireX;
