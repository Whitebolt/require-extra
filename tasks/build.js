'use strict';

const babel = require('gulp-babel');
const concat = require('gulp-concat');
const util = require(__cwd + '/src/util');
const semvar = require('semver');
const vcjd = require('vinyl-commonjs-dependencies');
const commonjsBrowserWrap = require('gulp-commonjs-browser-wrap');

function getBabelSettings(target) {
  const babelSettings = util.cloneDeep(gulpSettings.babel);
  babelSettings.presets[0][1].targets.node = target;

  babelSettings.presets[0][1].include = babelSettings.presets[0][1].include || [];

  if (semvar.lt(target, '4.0.0')) babelSettings.plugins.push('transform-regenerator');
  if (semvar.lt(target, '5.0.0')) babelSettings.presets[0][1].include.push('babel-plugin-transform-es2015-spread');
  if (semvar.lt(target, '7.6.0')) babelSettings.plugins.push('transform-async-generator-functions');

  return babelSettings;
}

function fn(gulp, done) {
  gulpSettings.nodeTargets.forEach((target, n)=>{
    const babelSettings = getBabelSettings(target);

    vcjd.src([__cwd + gulpSettings.main], {internalOnly:true})
      .pipe(commonjsBrowserWrap())
      .pipe(concat(target + '.js'))
      .pipe(babel(babelSettings))
      .pipe(commonjsBrowserWrap({
        type:'moduleWrap',
        main:__cwd + gulpSettings.main,
        includeGlobal:true,
        insertAtTop: (semvar.lt(target, '8.0.0') ? 'require("babel-polyfill");' : '')
      }))
      .pipe(gulp.dest(__cwd + gulpSettings.build))
      .on('end', ()=>{
        vcjd.src([
          __cwd + gulpSettings.tests + '/' + gulpSettings.main,
          './src/importSettings'
        ], {internalOnly:true})
          .pipe(commonjsBrowserWrap())
          .pipe(concat(target + '.js'))
          .pipe(babel(babelSettings))
          .pipe(commonjsBrowserWrap({
            type:'moduleWrap',
            main:__cwd + gulpSettings.tests + '/' + gulpSettings.main,
            includeGlobal:true,
            insertAtTop: (semvar.lt(target, '8.0.0') ? 'require("babel-polyfill");' : '')
          }))
          .pipe(gulp.dest(__cwd + gulpSettings.tests + '/' + gulpSettings.build))
          .on('end', ()=>{
            if (n >= (gulpSettings.nodeTargets.length - 1)) done();
          })
      });
  });
}

module.exports = {deps: ['jsdoc-json'], fn};
