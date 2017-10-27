'use strict';

const config = require('./config');
const {uniq, flattenDeep, pick, promisify, makeArray, pullAll} = require('./util');
const Private = require("./Private");

const allowedOptions = [
  'basedir', 'package', 'extensions', 'readFile', 'isFile', 'packageFilter',
  'pathFilter', 'paths', 'moduleDirectory', 'preserveSymlinks'
];

function _importOptions(instance, options={}) {
  const _options = Object.assign({
    extensions: new Set(makeArray(config.get('extensions'))),
    moduleDirectory: options.moduleDirectory || options.modules || config.get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  if (_options.modules) console.warn('The property options.modules is deprecated, please use options.moduleDirectory instead.');

  Object.assign(instance, pick(_options, allowedOptions));
}

class Resolver {
  constructor(options) {
    _importOptions(this, options);
  }

  resolve(moduleId, dir, cb) {
    const resolver = config.get('resolver');
    const options = Object.assign(pick(this, allowedOptions), {basedir:dir || __dirname});
    return (cb ? resolver(moduleId, options, cb) : promisify(resolver)(moduleId, options));
  }

  addExtensions(...ext) {
    this.extensions = uniq([...this.extensions, ...flattenDeep(ext)]);
    return this.extensions;
  }

  removeExtensions (...ext) {
    this.extensions = pullAll(this.extensions, flattenDeep(ext));
    return this.extensions;
  }

  get extensions() {
    return Private.get(this, 'extensions', Array);
  }

  set extensions(value) {
    Private.set(this, 'extensions', makeArray(value));
    return true;
  }

  getState() {
    return pick(this, allowedOptions);
  }

  isCoreModule(moduleId) {
    return !!config.get('resolver').isCore(moduleId);
  }
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
function getResolver(options) {
  return new Resolver(options);
}

module.exports = getResolver;
