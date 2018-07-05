'use strict';

const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify || Promise.promisify || require('./util').promisify;

const _readDir = (!!fs.promises ? fs.promises.readdir : promisify(fs.readdir));

const readFileCallbacks = new Map();
let settings;

let loading = 0;
const {statDir, statFile, statCache, lStatCache, fileQueue, readDirCache} = require('./stores');

const _statPromise = promisify(_stat);
const _lstatPromise = promisify(_lstat);
const _isFilePromise = promisify(_isFile);
const _isDirectoryPromise = promisify(_isDirectory);


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

function lstat(file, cb) {
  if (cb) return _lstat(file, cb);
  return _lstatPromise(file);
}

function __lstat(file, cb) {
  fs.lstat(file, (err, stat)=>{
    lStatCache.set(file, [err, stat]);
    if (!err) {
      if (!stat.isSymbolicLink()) statCache.set(file, [null, stat]);
      return cb(null, stat);
    }
    return cb(err, null);
  });
}

function _lstat(file, cb) {
  if (lStatCache.has(file)) return cb(...lStatCache.get(file));
  const parent = path.dirname(file);
  if (parent !== file) return isDirectory(parent, (err, isDir)=>{
    if (!!err) {
      lStatCache.set(file, [err, null]);
      return cb(err, null);
    } else if (!isDir) {
      const _err = new Error('No parent directory');
      lStatCache.set(file, [err, null]);
      return cb(err, null);
    }
    return __lstat(file, cb);
  });
  return __lstat(file, cb);
}

function _stat(file, cb) {
  if (cb) return _stat(file, cb);
  return _statPromise(file);
}

function __stat(file, cb) {
  fs.stat(file, function(err, stat) {
    statCache.set(file, [err, stat]);
    if (!err) return cb(null, stat);
    return cb(err, null);
  });
}

function stat(file, cb) {
  if (statCache.has(file)) return cb(...statCache.get(file));
  const parent = path.dirname(file);
  if (parent !== file) return isDirectory(parent, (err, isDir)=>{
    if (!!err) {
      statCache.set(file, [err, null]);
      return cb(err, null);
    } else if (!isDir) {
      const _err = new Error('No parent directory');
      statCache.set(file, [err, null]);
      return cb(err, null);
    }
    return __stat(file, cb);
  });
  return __stat(file, cb);
}

function statSync(file) {
  if (statCache.has(file)) {
    const result =  statCache.get(file);
    if (!result[0]) return result[1];
    throw result[0];
  } else {
    try {
      var stat = fs.statSync(file);
      statCache.set(file, [null, stat]);
      return stat;
    } catch (err) {
      statCache.set(file, [err, null]);
      throw err;
    }
  }
}

function statAction(err, stat, cb) {
  if (!err) return (!!cb?cb(null, stat):stat);
  if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return (!!cb?cb(null, false):false);
  return (!!cb?cb(err):err);
}

function isFile(file, cb) {
  if (cb) return _isFile(file, cb);
  return _isFilePromise(file);
}

function __isFile(file, cb) {
  stat(file, function(err, stat) {
    if (!err) {
      statFile.set(file, [null, stat.isFile() || stat.isFIFO()]);
      return statAction(null, statFile.get(file)[1], cb);
    }
    statFile.set(file, [err, null]);
    return statAction(err, null, cb);
  });
}

function _isFile(file, cb) {
  if (statFile.has(file)) return statAction(...statFile.get(file), cb);
  const parent = path.dirname(file);
  if (parent !== file) return isDirectory(parent, (err, isDir)=>{
    if (!!err) {
      statFile.set(file, [err, null]);
      return statAction(err, null, cb);
    } else if (!isDir) {
      statFile.set(file, [null, false]);
      return statAction(null, false, cb);
    }
    return __isFile(file, cb);
  });

  return __isFile(file, cb);
}

function isFileSync(file) {
  if (statFile.has(file)) return statAction(...statFile.get(file));
  const parent = path.dirname(file);
  if ((parent !== file) && !isDirectorySync(path.dirname(file))) return false;
  try {
    const stat = statSync(file);
    statFile.set(file, [null, stat.isFile() || stat.isFIFO()]);
    return statAction(null, statFile.get(file)[1]);
  } catch (err) {
    statFile.set(file, [err, null]);
    return statAction(err, null);
  }
}

function isDirectory(dir, cb) {
  if (cb) return _isDirectory(dir, cb);
  return _isDirectoryPromise(dir);
}

function __isDirectory(dir, cb) {
  stat(dir, function(err, stat) {
    if (!err) {
      statDir.set(dir, [null, stat.isDirectory()]);
      return statAction(null, statDir.get(dir)[1], cb);
    }
    statDir.set(dir, [err, null]);
    return statAction(err, null, cb);
  });
}

function _isDirectory(dir, cb) {
  if (statDir.has(dir)) return statAction(...statDir.get(dir), cb);
  const parent = path.dirname(dir);
  if (parent !== dir) return isDirectory(parent, (err, isDir)=>{
    if (!!err) {
      statDir.set(dir, [err, null]);
      return statAction(err, null, cb);
    } else if (!isDir) {
      statDir.set(dir, [null, false]);
      return statAction(null, false, cb);
    }
    return __isDirectory(dir, cb);
  });
  return __isDirectory(dir, cb);
}

function isDirectorySync(dir) {
  if (statDir.has(dir)) return statAction(...statDir.get(dir));
  const parent = path.dirname(dir);
  if ((parent !== dir) && !isDirectorySync(path.dirname(dir))) return false;
  try {
    const stat = statSync(dir);
    statDir.set(dir, [null, stat.isDirectory()]);
    return statAction(null, statDir.get(dir)[1]);
  } catch (err) {
    statDir.set(dir, [err, null]);
    return statAction(err, null);
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
  readDir, lstat, isFile, isFileSync, isDirectory, isDirectorySync, statSync, stat,
  readFile, readFileSync, nodeReadFile
};