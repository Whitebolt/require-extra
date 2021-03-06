'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const {isString, makeArray, values, isFunction} = require('./util');
const Module = require('./Module');
const workspaces = require('./workspaces');
const emitter = require('./events');
const settings = require('./settings');
const cache = require('./cache');

const proxiedGlobal = require('semver').gt(process.versions.node, '8.3.0');


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
    workspace: [workspaces.DEFAULT_WORKSPACE],
    squashErrors: !!(config.resolver || {}).squashErrors
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
  try {
    return new vm.Script(stringScript, options);
  } catch(error) { // These are not squashed as not evaluation errors but something else.
    if (_runError(error, module)) throw error;
  }
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
  module.exports = _error;
  emitter.emit('error', _error);
  return (!!_error.ignore || (_error.ignore && isFunction(_error.ignore) && _error.ignore()));
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
  const module = new Module(config);
  const scopeParams = _getScopeParams(config, module, config.scope);
  const script = _createScript(config, options, config.scope);

  try {
    if (useSandbox) {
      script.runInContext(_createSandbox(config), options)(...scopeParams);
    } else {
      script.runInThisContext(options)(...scopeParams);
    }
  } catch(error) {
    if (config.squashErrors) cache.delete(options.filename);
    if (!config.squashErrors) {
      if (_runError(error, module)) throw error;
    } else {
      throw error;
    }
  }

  return module;
}



/**
 * Given a config object, evaluate the given content in a sandbox according to the config.  Return the module.
 *
 * @param {Object} config     Config to use.
 * @returns {Module}
 */
function evaluate(config) {
  const _config = _parseConfig(config);
  const options = _createOptions(_config);
  return _runScript(_config, options);
}


module.exports = evaluate;