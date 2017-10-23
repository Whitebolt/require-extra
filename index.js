'use strict';

require('./lib/importSettings')('gulp');
module.exports = require('./lib/versionLoader')(__cwd + gulpSettings.build);