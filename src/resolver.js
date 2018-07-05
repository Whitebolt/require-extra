'use strict';

const settings = require('./settings');
const Private = require("./Private");
const Triple_Map = require("./Triple_Map");
const path = require('path');
const {
  isDirectory,
  isDirectorySync,
  isFile,
  isFileSync,
  uniq,
  flattenDeep,
  pick,
  promisify,
  makeArray,
  without,
  chain
} = require('./util');

const cache = new Triple_Map();
const pathsLookup = new Private();
const $private = new Private();

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
    return makeArray($private.get(this, 'extensions'));
  }

  set extensions(value) {
    $private.set(this, 'extensions', makeArray(value));
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
