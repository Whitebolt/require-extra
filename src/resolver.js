'use strict';

const config = require('./config');
const {uniq, flattenDeep, pick, promisify, makeArray, without, getCallingFileName} = require('./util');
const Private = require("./Private");

const _resolveLike = ['resolve', 'extensions', 'getState', 'isCoreModule', 'addExtenstions', 'removeExtensions'];
Object.freeze(_resolveLike);

const allowedOptions = [
  'basedir', 'package', 'extensions', 'readFile', 'isFile', 'packageFilter',
  'pathFilter', 'paths', 'moduleDirectory', 'preserveSymlinks'
];

const otherOptions = ['parent'];

const toExport = ['moduleDirectory', 'parent'];


function _importOptions(instance, options={}) {
  const _options = Object.assign({
    extensions: new Set(makeArray(config.get('extensions'))),
    moduleDirectory: options.moduleDirectory || options.modules || config.get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  if (_options.modules) console.warn(`The property options.modules is deprecated, please use options.moduleDirectory instead. This being used in ${getCallingFileName()}`);

  Object.assign(instance, pick(_options, allowedOptions), pick(_options, otherOptions));
}

class Resolver {
  constructor(options) {
    _importOptions(this, options);
  }

  resolve(moduleId, dir, cb) {
    const resolver = config.get('resolve-module');
    const options = Object.assign(pick(this, allowedOptions), {basedir:dir || __dirname});
    return (cb ? resolver(moduleId, options, cb) : promisify(resolver)(moduleId, options));
  }

  resolveSync(moduleId, dir) {
    const resolver = config.get('resolve-module');
    const options = Object.assign(pick(this, allowedOptions), {basedir:dir || __dirname});
    return resolver.sync(moduleId, options);
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
    config.set('extensions', uniq([...config.get('extensions'), ...flattenDeep(ext)]));
    return config.get('extensions');
  }

  static removeExtensions (...ext) {
    config.set('extensions', without(config.get('extensions'), ...flattenDeep(ext)));
    return config.get('extensions');
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
    return !!config.get('resolve-module').isCore(moduleId);
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
