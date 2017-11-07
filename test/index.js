'use strict';

var semvar = require('semver');
var settings = require(process.cwd() + '/src/importSettings')('gulp');
var requireX;

global.gulpSettings = settings;
global.__cwd = settings.cwd;


if (semvar.lt('7.5.99', process.versions.node)) {
  requireX = require(__cwd + './test/src/')
} else {
  requireX = require(__cwd + './src/versionLoader')(__cwd + gulpSettings.tests + '/' + gulpSettings.build);
}

module.exports = requireX;

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at: Promise', promise, 'reason:', reason);
});