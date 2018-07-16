'use strict';

const readFileCallbacks = new Map();
let settings;
let loading = 0;

const {memoize, memoizeNode, memoizePromise, memoizeRegExp} = require('./memoize');
const xTrailingSlash = memoizeRegExp(/\/$/);

const {statDir, statFile, statCache, lStatCache, fileQueue, readDirCache} = require('./stores');


const fs = Object.assign({}, require('fs'));
if (Object.getOwnPropertyDescriptor(fs, 'promises')) {
  Object.defineProperty(fs, 'promises', {
    get() {return fs.promises}
  });
}

const fileMemoizeResolver = path=>{
  if (!settings) settings = require('./settings');
  return xTrailingSlash.replace(path, '');
};

const path = require('path');
const promisify = require('util').promisify || Promise.promisify || require('./util').promisify;
const {lstat, lstatSync} = createLstatMethods(lStatCache, statCache);
const {stat, statSync} = createStatMethods(statCache);
const {isDirectory, isDirectorySync} = createIsDirectoryMethods(statDir);
const {isFile, isFileSync} = createIsFileMethods(statFile);
const {readDir, readDirSync} = createReadDirMethods(readDirCache);




function createStatMethods(cache=new Map()) {
  const _stat = memoizeNode(fs.stat, fileMemoizeResolver);
  const statSync = memoize(fs.statSync, fileMemoizeResolver);
  const statPromise = memoizePromise(!!fs.promises?fs.promises.stat:promisify(fs.stat), fileMemoizeResolver);
  const stat = (file, cb)=>(!cb?statPromise(file):_stat(file, cb));

  _stat.cache = cache;
  statSync.cache = cache;
  statPromise.cache = cache;

  return {stat, statSync};
}

function createLstatMethods(cache=new Map(), statCache) {
  const _lstat = memoizeNode((file, cb)=>fs.lstat(file, (err, stat)=>{
    if (!err && !stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
    return cb(err, stat);
  }), fileMemoizeResolver);
  const lstatSync = memoize(file=>{
    const stat = fs.lstatSync;
    if (!stat.isSymbolicLink() && !!statCache) statCache.set(file, [null, stat]);
    return stat;
  }, fileMemoizeResolver);
  const lstatPromise = memoizePromise(!!fs.promises?fs.promises.lstat:promisify(fs.lstat), fileMemoizeResolver);
  const lstat = (file, cb)=>(!cb?lstatPromise(file):_lstat(file, cb));

  _lstat.cache = cache;
  lstatSync.cache = cache;
  lstatPromise.cache = cache;

  return {lstat, lstatSync};
}

const _testParentDirectory = (parent, doStat, file, cb)=>isDirectory(parent, (err, isDir)=>{
  if (!!err) return cb(err, null);
  if (!isDir) return cb(null, false);
  return doStat(file, cb);
});

function createIsFileMethods(cache=new Map()) {
  const doStat = (file, cb)=>stat(file, (err, stat)=>{
    if (!err) return cb(null, stat.isFile() || stat.isFIFO());
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
    return cb(err);
  });

  const _isFile = memoizeNode((file, cb)=>{
    const parent = path.dirname(file);
    if (parent === path) return doStat(file, cb);
    return _testParentDirectory(parent, doStat, file, cb);
  }, fileMemoizeResolver);

  const isFileSync = memoize(file=>{
    try {
      const parent = path.dirname(file);
      if ((parent !== file) && !isDirectorySync(parent)) return false;
      const stat = statSync(file);
      return stat.isFile() || stat.isFIFO();
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
      throw err;
    }
  }, fileMemoizeResolver);
  const isFilePromise = memoizePromise(promisify(_isFile), fileMemoizeResolver);
  const isFile = (file, cb)=>(!cb?isFilePromise(file):_isFile(file, cb));

  _isFile.cache = cache;
  isFileSync.cache = cache;
  isFilePromise.cache = cache;

  return {isFile, isFileSync};
}

function createIsDirectoryMethods(cache=new Map()) {
  const doStat = (dir, cb)=>stat(dir, (err, stat)=>{
    if (!err) return cb(null, stat.isDirectory());
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
    return cb(err);
  });

  const _isDirectory = memoizeNode((dir, cb)=>{
    const parent = path.dirname(dir);
    if (parent === dir) return doStat(dir, cb);
    return _testParentDirectory(parent, doStat, dir, cb);
  }, fileMemoizeResolver);

  const isDirectorySync = memoize(dir=>{
    try {
      const parent = path.dirname(dir);
      if ((parent !== dir) && !isDirectorySync(parent)) return false;
      const stat = statSync(dir);
      return stat.isDirectory();
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
      throw err;
    }
  }, fileMemoizeResolver);
  const isDirectoryPromise = memoizePromise(promisify(_isDirectory), fileMemoizeResolver);
  const isDirectory = (dir, cb)=>(!cb?isDirectoryPromise(dir):_isDirectory(dir, cb));

  _isDirectory.cache = cache;
  isDirectorySync.cache = cache;
  isDirectoryPromise.cache = cache;

  return {isDirectory, isDirectorySync};
}

function createReadDirMethods(cache=new Map()) {
  const _readDir = memoizeNode(fs.readdir, fileMemoizeResolver);
  const readDirSync = memoize(fs.readdirSync, fileMemoizeResolver);
  const readDirPromise = memoizePromise(!!fs.promises?fs.promises.readdir:promisify(fs.readdir), fileMemoizeResolver);
  const readDir = (dir, cb)=>(!cb?readDirPromise(dir):_readDir(dir, cb));

  _readDir.cache = cache;
  readDirSync.cache = cache;
  readDirPromise.cache = cache;

  return {readDir, readDirSync}
}

/**
 * Add a callback for reading of given file.
 *
 * @private
 * @param {string} filename           File to set callback for.
 * @returns {Promise.<Buffer|*>}      The file contents, once loaded.
 */
function _addReadCallback(filename) {
  return new Promise((resolve, reject)=> {
    readFileCallbacks.get(filename).add((err, data)=> {
      if (err) return reject(err);
      return resolve(data);
    });
  });
}

/**
 * Add callbacks set for given file
 *
 * @private
 * @param {string} filename     File to add for.
 * @param {Map} cache           Cache to use.
 * @returns {Set}               The callbacks.
 */
function _addReadCallbacks(filename, cache) {
  const callbacks = new Set();
  cache.set(filename, true);
  readFileCallbacks.set(filename, callbacks);
  return callbacks;
}

/**
 * Return cached file if already loaded or set a callback if currently loading/in-queue.
 *
 *
 * @param {string} filename           File to get from cache.
 * @param {Map} cache                 The cache to use.
 * @returns {Promise.<Buffer|*>}      The file contents.
 */
async function _handleFileInCache(filename, cache) {
  if (cache.get(filename) !== true) return cache.get(filename);
  return _addReadCallback(filename);
}

/**
 * Fire any awaiting callbacks for given file data.
 *
 * @private
 * @param {string} filename           The filename to fire callbacks on.
 * @param {Buffer|Error} data         The received data.
 * @param {boolean} [error=false]     Is this an error or file data?
 */
function _fireReadFileCallbacks(filename, data, error=false) {
  const callbacks = readFileCallbacks.get(filename);
  if (callbacks) {
    if (callbacks.size) callbacks.forEach(callback=>error?callback(data, null):callback(null, data));
    callbacks.clear();
    readFileCallbacks.delete(filename);
  }
}

/**
 * File queue handler.
 *
 * @private
 */
function _runFileQueue() {
  if (!settings) settings = require('./settings');
  const simultaneous = settings.get('load-simultaneously') || 10;

  if ((loading < simultaneous) && (fileQueue.length)) {
    loading++;
    fileQueue.shift()();
  }
}

/**
 * On end listener for readFile.
 *
 * @private
 * @param {string} filename           The filename.
 * @param {Array.<Buffer>} contents   The file contents as a series of buffers.
 * @param {Map} cache                 The file cache.
 */
function _readFileOnEnd(filename, contents, cache) {
  loading--;
  const data = Buffer.concat(contents);
  cache.set(filename, data);
  _fireReadFileCallbacks(filename, data);
  _runFileQueue();
}

/**
 * On error listener for readFile.
 *
 * @private
 * @param {string} filename     The filename.
 * @param {Error} error         The error fired.
 */
function _readFileOnError(filename, error) {
  loading--;
  _fireReadFileCallbacks(filename, error);
  _runFileQueue();
}

/**
 * Load a file synchronously using a cache.
 *
 * @public
 * @param {string} filename               The file to load.
 * @param {Map} cache                     The cache to use.
 * @param {null|string} [encoding=null]   The encoding to load as.
 * @returns {Promise.<Buffer|*>}          The load results.
 */
function readFile(filename, cache, encoding=null) {
  if (cache.has(filename)) return _handleFileInCache(filename, cache);
  _addReadCallbacks(filename, cache);
  fileQueue.push(()=>{
    const contents = [];
    fs.createReadStream(filename, {encoding})
      .on('data', chunk=>contents.push(chunk))
      .on('end', ()=>_readFileOnEnd(filename, contents, cache))
      .on('error', error=>_readFileOnError(filename, error))
  });
  _runFileQueue();
  return _handleFileInCache(filename, cache);
}

function nodeReadFile(cache, filename, options, cb) {
  const _cb = (!cb?options:cb);
  const _options = (!cb?{encoding:null}:options);

  return readFile(filename, cache, _options.encoding)
    .then(data=>{
      _cb(null, data);
      return data;
    }, err=>{
      _cb(err);
      return Promise.reject(err);
    });
}

/**
 * Read a file synchronously using file cache.
 *
 * @param {string} filename               The filename to load.
 * @param {Map} cache                     The cache to use.
 * @param {null|strin} [encoding=null]    The encoding to use.
 * @returns {Buffer\*}                    The file contents as a buffer.
 */
function readFileSync(filename, cache, encoding=null) {
  if (cache.has(filename) && (cache.get(filename) !== true)) return cache.get(filename);
  const data = fs.readFileSync(filename, encoding);
  cache.set(filename, data);
  return data;
}



module.exports = {
  readDir, lstat, lstatSync, isFile, isFileSync, isDirectory, readDirSync, isDirectorySync, statSync, stat,
  readFile, readFileSync, nodeReadFile
};