'use strict';

const mocha = require('gulp-mocha');

function fn(gulp, done) {
  return gulp.src(__cwd + gulpSettings.tests + '/index.js', {read: false})
    .pipe(mocha(gulpSettings.mocha || {}))
    .on('end', done);
}

module.exports = {deps: ['build'], fn};