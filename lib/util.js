'use strict';

const Promise = require('bluebird');  // jshint ignore:line
const fs = require('fs');
const util = require('lodash-provider');
util.__require = require;

util.readDir = Promise.promisify(fs.readdir);
util.readFile = Promise.promisify(fs.readFile);

module.exports = util;
