'use strict';

const babel = require('gulp-babel');
const concat = require('gulp-concat');
const util = require(__cwd + '/src/util');
const semvar = require('semver');
const vcjd = require('vinyl-commonjs-dependencies');
const commonjsBrowserWrap = require('gulp-commonjs-browser-wrap');

const vcJdOptions = {
  internalOnly:true,
  debugVcjd: false
};

function getBabelSettings(target) {
  const babelSettings = util.cloneDeep(gulpSettings.babel);
  babelSettings.presets[0][1].targets.node = target;

  babelSettings.presets[0][1].include = babelSettings.presets[0][1].include || [];

  if (semvar.lt(target, '4.0.0')) babelSettings.plugins.push('transform-regenerator');
  if (semvar.lt(target, '5.0.0')) babelSettings.presets[0][1].include.push('babel-plugin-transform-es2015-spread');
  if (semvar.lt(target, '7.6.0')) babelSettings.plugins.push('transform-async-generator-functions');

  return babelSettings;
}

function wrapSettings(base='') {
  return {
    type:'moduleWrap',
    main:__cwd + base + gulpSettings.main,
    includeGlobal:true,
    debug:true
  };
}

function getDest(base='') {
  return __cwd + base + gulpSettings.build;
}

function fn(gulp, done) {
  gulpSettings.nodeTargets.forEach((target, n)=>{
    const babelSettings = getBabelSettings(target);
    const outputFilename = target + '.js';

    vcjd.src([__cwd + gulpSettings.main], vcJdOptions)
      .pipe(commonjsBrowserWrap({debug:true}))
      .pipe(concat(outputFilename))
      .pipe(babel(babelSettings))
      .pipe(commonjsBrowserWrap(wrapSettings()))
      .pipe(gulp.dest(getDest()))
      .on('end', ()=>{
        vcjd.src([
          __cwd + gulpSettings.tests + '/' + gulpSettings.main,
          './src/importSettings'
        ], vcJdOptions)
          .pipe(commonjsBrowserWrap({debug:true}))
          .pipe(concat(outputFilename))
          .pipe(babel(babelSettings))
          .pipe(commonjsBrowserWrap(wrapSettings(gulpSettings.tests + '/')))
          .pipe(gulp.dest(getDest(gulpSettings.tests + '/')))
          .on('end', ()=>{
            if (n >= (gulpSettings.nodeTargets.length - 1)) done();
          })
      });
  });
}

module.exports = {deps: ['jsdoc-json'], fn};
