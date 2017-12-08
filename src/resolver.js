'use strict';

const settings = require('./settings');
const {uniq, flattenDeep, pick, promisify, makeArray, without, getCallingFileName} = require('./util');
const Private = require("./Private");
const path = require('path');

const _resolveLike = ['resolve', 'extensions', 'getState', 'isCoreModule', 'addExtenstions', 'removeExtensions'];
Object.freeze(_resolveLike);

const allowedOptions = [
  'basedir', 'package', 'extensions', 'readFile', 'isFile', 'packageFilter',
  'pathFilter', 'paths', 'moduleDirectory', 'preserveSymlinks'
];

const otherOptions = ['parent', 'useSandbox', 'useSyncRequire', 'merge', 'scope', 'options', 'squashErrors'];

const toExport = ['moduleDirectory', 'parent', 'useSandbox', 'useSyncRequire', 'merge', 'scope', 'options', 'squashErrors'];

const cache = new Map();


function _importOptions(instance, options={}) {
  const _options = Object.assign({
    extensions: new Set(makeArray(settings.get('extensions'))),
    moduleDirectory: options.moduleDirectory || options.modules || settings.get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  if (_options.modules) console.warn(`The property options.modules is deprecated, please use options.moduleDirectory instead. This being used in ${getCallingFileName()}`);

  Object.assign(instance, pick(_options, allowedOptions), pick(_options, otherOptions));
}

function has(moduleId, moduleDirectory, basedir) {
  return (
    cache.has(moduleId) &&
    cache.get(moduleId).has(moduleDirectory) &&
    cache.get(moduleId).get(moduleDirectory).has(basedir)
  );
}

function get(moduleId, moduleDirectory, basedir) {
  if (!has(moduleId, moduleDirectory, basedir)) return;
  return cache.get(moduleId).get(moduleDirectory).get(basedir);
}

function set(moduleId, moduleDirectory, basedir, resolved) {
  if (!cache.has(moduleId)) cache.set(moduleId, new Map());
  if (!cache.get(moduleId).has(moduleDirectory)) cache.get(moduleId).set(moduleDirectory, new Map());
  cache.get(moduleId).get(moduleDirectory).set(basedir, resolved);

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
    const options = Object.assign(pick(this, allowedOptions), {basedir:dir || __dirname});
    if (has(moduleId, options.moduleDirectory, options.basedir)) {
      const resolved = get(moduleId, options.moduleDirectory, options.basedir);
      if (!cb) return Promise.resolve(resolved);
      cb(resolved);
    } else {
      const resolver = settings.get('resolveModule');
      if (cb) {
        resolver(moduleId, options, resolved=>{
          cb(set(moduleId, options.moduleDirectory, options.basedir, resolved));
        });
      } else {
        return promisify(resolver)(moduleId, options).then(resolved=>{
          return set(moduleId, options.moduleDirectory, options.basedir, resolved);
        });
      }
    }
  }

  resolveSync(moduleId, dir) {
    const options = Object.assign(pick(this, allowedOptions), {basedir:dir || __dirname});
    if (has(moduleId, options.moduleDirectory, options.basedir)) {
      return get(moduleId, options.moduleDirectory, options.basedir);
    }
    const resolver = settings.get('resolveModule');
    return set(moduleId, options.moduleDirectory, options.basedir, resolver.sync(moduleId, options));
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
