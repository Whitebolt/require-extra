'use strict';

require('./src/importSettings')('gulp');
module.exports = require('./src/versionLoader')(__cwd + gulpSettings.build);
//module.exports = require('./src');