'use strict';

require(process.cwd() + '/lib/importSettings')('gulp');
module.exports = require(__cwd + './lib/versionLoader')(__cwd + gulpSettings.tests + '/' + gulpSettings.build);