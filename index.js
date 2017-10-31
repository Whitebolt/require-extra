'use strict';

var settings = require('./src/importSettings')('gulp');
var requireX = require('./src/versionLoader')(settings.cwd + settings.build);
requireX.set('parent', module.parent);
module.exports = requireX;
