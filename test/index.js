'use strict';

var settings = require(process.cwd() + '/src/importSettings')('gulp');
global.gulpSettings = settings;
global.__cwd = settings.cwd;
module.exports = require(__cwd + './src/versionLoader')(__cwd + gulpSettings.tests + '/' + gulpSettings.build);
//module.exports = require('./src');