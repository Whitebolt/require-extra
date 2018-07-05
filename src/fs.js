'use strict';

const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify || Promise.promisify || require('./util').promisify;
const [statDir, statFile, statCache, lStatCache] = [new Map(), new Map, new Map(), new Map()];

const readDir = (!!fs.promises ? fs.promises.readdir : promisify(fs.readdir));

const _statPromise = promisify(_stat);
const _lstatPromise = promisify(_lstat);
const _isFilePromise = promisify(_isFile);
const _isDirectoryPromise = promisify(_isDirectory);


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


module.exports = {
  readDir, lstat, isFile, isFileSync, isDirectory, isDirectorySync, statSync, stat
};