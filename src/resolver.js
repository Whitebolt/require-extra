'use strict';

const settings = require('./settings');
const $private = require("@simpo/private").getInstance();
const path = require('path');
const {
  isDirectory,
  isDirectorySync,
  isFile,
  isFileSync,
  nodeReadFile,
  readFileSync,
  uniq,
  flattenDeep,
  pick,
  promisify,
  makeArray,
  without,
  chain
} = require('./util');
const {fileCache, resolveCache} = require('./stores');
const {memoize} = require('./memoize');


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

const getExtraPaths = memoize(function(roots, moduleDirectory='node_modules') {
  const paths = chain(roots)
    .map(root=>{
      let cPath = '/';
      return chain(root.split(path.sep))
        .map(part=>{
          cPath = path.join(cPath, part);
          return path.join(cPath, moduleDirectory);
        })
        .value();
    })
    .flatten()
    .reverse()
    .uniq()
    .value();

  return paths;
}, {cacheParams:2});

const getRoots = memoize(function(roots, dir) {
  return roots.findIndex((rootPath, n)=>(isChildOf(dir, rootPath) && (n>0)));
}, {cacheParams:2});

function getPaths(dir, options) {
  const roots = settings.get('roots');
  if (!roots) return [];

  const found = getRoots(roots, dir);
  if (found < 0) return [];

  return getExtraPaths(found, options.moduleDirectory);
}

function resolve(moduleId, options, sync=false) {
  const {moduleDirectory, basedir} = options;
  if (resolveCache.has(moduleId, moduleDirectory, basedir)) return resolveCache.get(moduleId, moduleDirectory, basedir);
  const resolver = settings.get('resolveModule');
  if (!sync) return promisify(resolver)(moduleId, options).then(resolved=>{
    resolveCache.set(moduleId, moduleDirectory, basedir, resolved);
    return resolved;
  });

  const resolved = resolver.sync(moduleId, options);
  resolveCache.set(moduleId, moduleDirectory, basedir, resolved);
  return resolved;
}

class Resolver {
  constructor(options) {
    _importOptions(this, options);
    if (!this.basedir && settings.has('parent')) {
      this.basedir = path.dirname(settings.get('parent').filename || settings.get('parent'));
    }
  }

  resolve(moduleId, basedir=this.basedir||__dirname, cb) {
    const options = {
      ...pick(this, allowedOptions),
      basedir,
      isDirectory,
      isFile,
      readFile: (...params)=>nodeReadFile(fileCache, ...params)
    };

    options.paths = [...(options.paths||[]), ...getPaths(basedir, options)];
    if (!cb) return resolve(moduleId, options);
    return resolve(moduleId, options).then(resolved=>cb(null, resolved), err=>cb(err, null));
  }

  resolveSync(moduleId, basedir=this.basedir||__dirname) {
    const options = {
      ...pick(this, allowedOptions),
      basedir,
      isDirectory: isDirectorySync,
      isFile: isFileSync,
      readFile: (path, {encoding=null})=>readFileSync(path, fileCache, encoding)
    };

    options.paths = [...(options.paths||[]),...getPaths(basedir, options)];
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

  get [Symbol.toStringTag]() {
    return 'Resolver';
  }
}

module.exports = Resolver;
