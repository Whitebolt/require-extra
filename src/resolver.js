'use strict';

const settings = require('./settings');
const {uniq, flattenDeep, pick, promisify, makeArray, without, chain} = require('./util');
const Private = require("./Private");
const path = require('path');
const fs = require('fs');

const _resolveLike = Object.freeze([
  'resolve',
  'extensions',
  'getState',
  'isCoreModule',
  'addExtenstions',
  'removeExtensions'
]);

const allowedOptions = [
  'basedir',
  'package',
  'extensions',
  'readFile',
  'isFile',
  'isDirectory',
  'packageFilter',
  'pathFilter',
  'paths',
  'moduleDirectory',
  'preserveSymlinks'
];

const otherOptions = [
  'parent',
  'useSandbox',
  'useSyncRequire',
  'merge',
  'scope',
  'options',
  'squashErrors'
];

const toExport = [
  'moduleDirectory',
  'parent',
  'useSandbox',
  'useSyncRequire',
  'merge',
  'scope',
  'options',
  'squashErrors'
];



function _importOptions(instance, options={}) {
  const _options = Object.assign({
    extensions: new Set(makeArray(settings.get('extensions'))),
    moduleDirectory: options.moduleDirectory || options.modules || settings.get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  if (_options.modules) console.warn(`The property options.modules is deprecated, please use options.moduleDirectory instead. This being used in ${getCallingFileName()}`);

  Object.assign(instance, pick(_options, allowedOptions), pick(_options, otherOptions));
}

class Resolve_Cache extends Map {
  has(moduleId, moduleDirectory, basedir) {
    return (
      super.has(moduleId) &&
      super.get(moduleId).has(moduleDirectory) &&
      super.get(moduleId).get(moduleDirectory).has(basedir)
    );
  }

  get(moduleId, moduleDirectory, basedir) {
    if (!this.has(moduleId, moduleDirectory, basedir)) return;
    return super.get(moduleId).get(moduleDirectory).get(basedir);
  }

  set(moduleId, moduleDirectory, basedir, resolved) {
    if (!this.has(moduleId, moduleDirectory, basedir)) {
      if (!super.has(moduleId)) super.set(moduleId, new Map());
      if (!super.get(moduleId).has(moduleDirectory)) super.get(moduleId).set(moduleDirectory, new Map());
    }
    super.get(moduleId).get(moduleDirectory).set(basedir, resolved);

    return resolved;
  }

  delete(moduleId, moduleDirectory, basedir) {
    if (!moduleDirectory && !basedir) return super.delete(moduleId);
    if (!!moduleDirectory && !basedir && super.has(moduleId)) {
      return super.get(moduleId).delete(moduleDirectory);
    }
    if (this.has(moduleId, moduleDirectory, basedir)) {
      return super.get(moduleId).get(moduleDirectory).delete(basedir);
    }
    return true;
  }

  get size() {
    let size = 0;
    [...super.keys()].forEach(moduleId=>
      [...super.get(moduleId).keys()].forEach(moduleDirectory=>{
        size += super.get(moduleId).get(moduleDirectory).size;
      })
    );
    return size;
  }
}

class Paths_Cache extends WeakMap {
  get(roots, found) {
    if (!super.has(roots)) return undefined;
    return super.get(roots).get(found);
  }

  set(roots, found, paths) {
    if (!super.has(roots)) super.set(roots, new Map());
    return super.get(roots).set(found, paths);
  }

  has(roots, found) {
    if (!super.has(roots)) return false;
    return super.get(roots).has(found);
  }

  delete(roots, found) {
    if (this.has(roots, found)) return super.get(roots).delete(found);
    if ((found === undefined) && this.has(roots)) return super.delete(roots);
    return true;
  }

  clear(roots) {
    if (super.has(roots)) return super.get(roots).clear();
  }
}

const cache = new Resolve_Cache();
const pathsLookup = new Paths_Cache();
const [statDir, statFile, statCache] = [new Map(), new Map, new Map()];

function isChildOf(child, parent) {
  return (child.substring(0, parent.length) === parent);
}

function getPaths(dir, options) {
  const roots = settings.get('roots');
  if (!roots) return [];

  const found = roots.findIndex((rootPath, n)=>(isChildOf(dir, rootPath) && (n>0)));
  if (found < 0) return [];
  if (pathsLookup.has(roots, found)) return pathsLookup.get(roots, found);

  const paths = chain(roots.slice(0, found))
    .map(root=>{
      let cPath = '/';
      return chain(root.split(path.sep))
        .map(part=>{
          cPath = path.join(cPath, part);
          return path.join(cPath, options.moduleDirectory || 'node_modules');
        })
        .value();
    })
    .flatten()
    .reverse()
    .uniq()
    .value();

  pathsLookup.set(roots, found, paths);
  return paths;
}

function resolve(moduleId, options, sync=false) {
  const {moduleDirectory, basedir} = options;
  if (cache.has(moduleId, moduleDirectory, basedir)) return cache.get(moduleId, moduleDirectory, basedir);
  const resolver = settings.get('resolveModule');
  if (!sync) return promisify(resolver)(moduleId, options).then(resolved=>{
    cache.set(moduleId, moduleDirectory, basedir, resolved);
    return resolved;
  });

  const resolved = resolver.sync(moduleId, options);
  cache.set(moduleId, moduleDirectory, basedir, resolved);
  return resolved;
}

function statAsync(file, cb) {
  if (statCache.has(file)) {
    const result =  statCache.get(file);
    if (!result[0]) return cb(null, result[1]);
    return cb(result[0], null);
  }
  fs.stat(file, function(err, stat) {
    if (!err) {
      statCache.set(file, [null, stat]);
      return cb(null, stat);
    }
    statCache.set(file, [err, null]);
    return cb(err, null);
  });
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
  if (statFile.has(file)) return statAction(...statFile.get(file), cb);
  isDirectory(path.dirname(file), (err, isDir)=>{
    if (!!err) {
      statFile.set(file, [err, null]);
      return statAction(err, null, cb);
    } else if (!isDir) {
      statFile.set(file, [null, false]);
      return statAction(null, false, cb);
    }

    statAsync(file, function(err, stat) {
      if (!err) {
        statFile.set(file, [null, stat.isFile() || stat.isFIFO()]);
        return statAction(null, statFile.get(file)[1], cb);
      }
      statFile.set(file, [err, null]);
      return statAction(err, null, cb);
    });
  });
}

function isFileSync(file) {
  if (statFile.has(file)) return statAction(...statFile.get(file));
  if (!isDirectorySync(path.dirname(file))) return false;
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
  if (statDir.has(dir)) return statAction(...statDir.get(dir), cb);
  statAsync(dir, function(err, stat) {
    if (!err) {
      statDir.set(dir, [null, stat.isDirectory()]);
      return statAction(null, statDir.get(dir)[1], cb);
    }
    statDir.set(dir, [err, null]);
    return statAction(err, null, cb);
  });
}

function isDirectorySync(dir) {
  if (statDir.has(dir)) return statAction(...statDir.get(dir));
  try {
    const stat = statSync(dir);
    statDir.set(dir, [null, stat.isDirectory()]);
    return statAction(null, statDir.get(dir)[1]);
  } catch (err) {
    statDir.set(dir, [err, null]);
    return statAction(err, null);
  }
}

class Resolver {
  constructor(options) {
    _importOptions(this, options);
    if (!this.basedir && settings.has('parent')) {
      this.basedir = path.dirname(settings.get('parent').filename || settings.get('parent'));
    }
  }

  resolve(moduleId, dir, cb) {
    const options = Object.assign(pick(this, allowedOptions), {
      basedir:dir || __dirname,
      isDirectory, isFile
    });

    options.paths = [...(options.paths||[]), ...getPaths(dir, options)];
    if (!cb) return resolve(moduleId, options);
    return resolve(moduleId, options).then(resolved=>cb(null, resolved), err=>cb(err, null));
  }

  resolveSync(moduleId, dir) {
    const options = Object.assign(pick(this, allowedOptions), {
      basedir:dir || __dirname,
      isDirectory: isDirectorySync,
      isFile: isFileSync
    });
    options.paths = [...(options.paths||[]),...getPaths(dir, options)];
    return resolve(moduleId, options, true);
  }

  addExtensions(...ext) {
    this.extensions = uniq([...this.extensions, ...flattenDeep(ext)]);
    return this.extensions;
  }

  removeExtensions (...ext) {
    this.extensions = without(this.extensions, ...flattenDeep(ext));
    return this.extensions;
  }

  static addExtenstions(...ext) {
    settings.set('extensions', uniq([...settings.get('extensions'), ...flattenDeep(ext)]));
    return settings.get('extensions');
  }

  static removeExtensions (...ext) {
    settings.set('extensions', without(settings.get('extensions'), ...flattenDeep(ext)));
    return settings.get('extensions');
  }

  static get resolveLike() {
    return _resolveLike;
  }

  get extensions() {
    return Private.get(this, 'extensions', Array);
  }

  set extensions(value) {
    Private.set(this, 'extensions', makeArray(value));
    return true;
  }

  get export() {
    return pick(this, toExport);
  }

  getState() {
    return pick(this, allowedOptions);
  }

  isCoreModule(moduleId) {
    return !!settings.get('resolveModule').isCore(moduleId);
  }

  /**
   * Generate a new resolver object following specific rules defined in the
   * options parameter. If no options are supplied, return a default resolver.
   *
   * @public
   * @param {Object} options    Options to pass to the resolver object
   * @returns {Object}          The new resolver object or the current module
   *                            resolver if no options supplied.
   */
  static getResolver(options) {
    console.warn(`This method is deprecated, please use new Resolver(<options>) instead. This being used in ${getCallingFileName()}`);
    return new Resolver(options);
  };
}

module.exports = Resolver;
