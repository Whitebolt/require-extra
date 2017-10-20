'use strict';

const mocha = require('gulp-mocha');

function fn(gulp, done) {
  return gulp.src(process.cwd() + '/test/index.js', {read: false})
    .pipe(mocha())
    .on('end', done);
}

module.exports = {deps: ['jsdoc-json'], fn};