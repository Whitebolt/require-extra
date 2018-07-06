'use strict';

const readFileCallbacks = new Map();
let settings;
let loading = 0;

const {statDir, statFile, statCache, lStatCache, fileQueue, readDirCache} = require('./stores');

const fs = require('fs');
const promisify = require('util').promisify || Promise.promisify || require('./util').promisify;
const {memoize, memoizeNode, memoizePromise} = require('./memoize');
const _readDir = (!!fs.promises ? fs.promises.readdir : promisify(fs.readdir));
const {lstat, lstatSync} = createLstatMethods(lStatCache);
const {stat, statSync} = createStatMethods(statCache);
const {isFile, isFileSync} = createIsFileMethods(statFile);
const {isDirectory, isDirectorySync} = createIsDirectoryMethods(statDir);


function createStatMethods(cache=new Map()) {
  const _stat = memoizeNode(fs.stat);
  const statSync = memoize(fs.statSync);
  const statPromise = memoizePromise(!!fs.promises?fs.promises.stat:promisify(fs.stat));
  const stat = (file, cb)=>(!cb?statPromise(file):_stat(file, cb));

  _stat.cache = cache;
  statSync.cache = cache;
  statPromise.cache = cache;

  return {stat, statSync};
}

function createLstatMethods(cache=new Map()) {
  const _lstat = memoizeNode(fs.lstat);
  const lstatSync = memoize(fs.lstatSync);
  const lstatPromise = memoizePromise(!!fs.promises?fs.promises.lstat:promisify(fs.lstat));
  const lstat = (file, cb)=>(!cb?lstatPromise(file):_lstat(file, cb));

  _lstat.cache = cache;
  lstatSync.cache = cache;
  lstatPromise.cache = cache;

  return {lstat, lstatSync};
}

function createIsFileMethods(cache=new Map()) {
  const _isFile = memoizeNode(function isFile(file, cb) {
    stat(file, (err, stat)=>{
      if (!err) return cb(null, stat.isFile() || stat.isFIFO());
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
      return cb(err);
    });
  });

  const isFileSync = memoize(function isFileSync(file) {
    try {
      const stat = statSync(file);
      return stat.isFile() || stat.isFIFO();
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
      throw err;
    }
  });
  const isFilePromise = memoizePromise(promisify(_isFile));
  const isFile = (file, cb)=>(!cb?isFilePromise(file):_isFile(file, cb));

  _isFile.cache = statFile;
  isFileSync.cache = statFile;
  isFilePromise.cache = statFile;

  return {isFile, isFileSync};
}

function createIsDirectoryMethods(cache=new Map()) {
  const _isDir = memoizeNode(function isDir(dir, cb) {
    stat(dir, (err, stat)=>{
      if (!err) return cb(null, stat.isDirectory());
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return cb(null, false);
      return cb(err);
    });
  });

  const isDirSync = memoize(function isDirSync(dir) {
    try {
      const stat = statSync(dir);
      return stat.isDirectory();
    } catch (err) {
      if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
      throw err;
    }
  });
  const isDirPromise = memoizePromise(promisify(_isDir));
  const isDir = (dir, cb)=>(!cb?isDirPromise(dir):_isDir(dir, cb));

  _isDir.cache = cache;
  isDirSync.cache = cache;
  isDirPromise.cache = cache;

  return {isDir, isDirSync};
}

async function readDir(dir) {
  if (readDirCache.has(dir)) {
    const results = readDirCache.get(dir);
    if (!results[0]) return results[1];
    return Promise.reject(results[0]);
  }

  try {
    const files = await _readDir(dir);
    readDirCache.set(dir, [null, files]);
    return files;
  } catch(err) {
    readDirCache.set(dir, [err, undefined]);
    return Promise.reject(err);
  }
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
  readDir, lstat, lstatSync, isFile, isFileSync, isDirectory, isDirectorySync, statSync, stat,
  readFile, readFileSync, nodeReadFile
};