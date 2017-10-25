'use strict';

require(process.cwd() + '/src/importSettings')('gulp');
module.exports = require(__cwd + './src/versionLoader')(__cwd + gulpSettings.tests + '/' + gulpSettings.build);
//module.exports = require('./src');