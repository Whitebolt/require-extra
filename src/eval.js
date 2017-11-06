'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const {isString, makeArray, values, isFunction} = require('./util');
const cache = require('./cache');
const Module = require('./Module');
const workspaces = require('./workspaces');
const emitter = require('./events');
const settings = require('./settings');

const proxiedGlobal = require('semver').gt(process.versions.node, '8.3.0');

const { r, g, b, w, c, m, y, k } = [
  ['r', 1], ['g', 2], ['b', 4], ['w', 7],
  ['c', 6], ['m', 5], ['y', 3], ['k', 0]
].reduce((cols, col) => ({
  ...cols,  [col[0]]: f => `\x1b[3${col[1]}m${f}\x1b[0m`
}), {});


/**
 * Parse a config, adding defaults.
 *
 * @private
 * @param {Object} config       Config to parse.
 * @returns {Object}            Parsed config.
 */
function _parseConfig(config) {
  const _config = Object.assign({}, {
    filename:module.parent.filename,
    scope: settings.get('scope') || {},
    includeGlobals:false,
    proxyGlobal:true,
    useSandbox: settings.get('useSandbox') || false,
    workspace: [workspaces.DEFAULT_WORKSPACE]
  }, config);

  if (isBuffer(_config.content)) _config.content = _config.content.toString();

  return _config;
}

/**
 * Given a config, create/get the sandbox for it.
 *
 * @private
 * @param {Object} config     Config for this operation.
 * @returns {Object|Proxy}    Sandbox object.
 */
function _createSandbox(config) {
  if (proxiedGlobal && proxiedGlobal) return workspaces.get(...makeArray(config.workspace));

  const sandbox = {};
  if (config.includeGlobals && (!proxiedGlobal || !config.proxyGlobal)) Object.assign(sandbox, global);
  //if (isObject(config.scope)) Object.assign(sandbox, config.scope);

  return vm.createContext(sandbox);
}

/**
 * Given a config object create an options object for sandboxing operations.
 *
 * @private
 * @param {Object} config   Config for this creation.
 * @returns {Object}        Options for sandboxing operations.
 */
function _createOptions(config) {
  return {
    filename:config.filename,
    displayErrors:true,
    timeout: config.timeout || 20*1000
  };
}

/**
 * Given a config and some options create a script ready for vm sandboxing.
 *
 * @param {Object} config       Config for this operation.
 * @param {options} options     Options for the script.
 * @returns {VMScript}          New script ready to use.
 */
function _createScript(config, options, scope={}) {
  if (!isString(config.content)) return config.content;
  const stringScript = wrap(config.content.replace(/^\#\!.*/, ''), scope);
  return new vm.Script(stringScript, options);
}

/**
 * Wrap the script content with scape parameters, including optional extra ones.
 *
 * @param {string} content      Content to wrap.
 * @param {Object} scope        Scope parameters to add.
 * @returns {string}            Wrapped script content.
 */
function wrap(content, scope) {
  const scopeParams = Object.keys(scope).join(',');
  const comma = ((scopeParams !== '')?', ':'');
  return `(function (exports, require, module, __filename, __dirname${comma}${scopeParams}) {
    ${content}
  });`
}

/**
 * Get scoped parameters to pass to wrap function.
 *
 * @private
 * @param {Object} config   The config options.
 * @param {Module} module   The module.
 * @returns {Array.<*>}     Parameters.
 */
function _getScopeParams(config, module, scope={}) {
  return [
    module.exports,
    module.require,
    module,
    module.filename,
    config.basedir || path.dirname(module.filename),
    ...values(scope)
  ];
}

/**
 * Handle run errors.
 *
 * @private
 * @param {Error} error       The error thrown.
 * @param {Module} module     The module.
 */
function _runError(error, module) {
  const _error = new emitter.Error({
    target:module.filename,
    source:(module.parent || module).filename,
    error
  });
  emitter.emit('error', _error);
  if (!_error.ignore()) throw error;
}

/**
 * Run the given script in the given sandbox, according to the given config and options.
 *
 * @private
 * @param {Object} config           Config to use.
 * @param {Object} options          Options for running.
 * @returns {Module}                The module created.
 */
function _runScript(config, options) {
  const useSandbox = ((isFunction(config.useSandbox)) ? _config.useSandbox(_config) || false : config.useSandbox);
  const scope = (isFunction(config.scope) ? config.scope(config) || {} : config.scope);
  const module = new Module(config);
  const scopeParams = _getScopeParams(config, module, scope);
  const script = _createScript(config, options, scope);

  try {
    if (useSandbox) {
      script.runInContext(_createSandbox(config), options)(...scopeParams);
    } else {
      script.runInThisContext(options)(...scopeParams);
    }
  } catch(error) {
    _runError(error, module);
  }

  module.loaded = true;

  return module;
}



/**
 * Given a config object, evaluate the given content in a sandbox according to the config.  Return the module.
 *
 * @param {Object} config     Config to use.
 * @returns {Module}
 */
function evaluate(config) {
  const time = process.hrtime();
  const _config = _parseConfig(config);
  const options = _createOptions(_config);
  const module = _runScript(_config, options);

  emitter.emit('evaluated', new emitter.Evaluated({
    target:module.filename,
    source:(module.parent || {}).filename,
    duration: process.hrtime(time),
    cacheSize: cache.size
  }));

  return module;
}


module.exports = evaluate;