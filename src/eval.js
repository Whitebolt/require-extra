'use strict';

const vm = require('vm');
const path = require('path');
const isBuffer = Buffer.isBuffer;
const {isString, makeArray} = require('./util');
const cache = require('./cache');
const Module = require('./Module');
const workspaces = require('./workspaces');

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
  const _config = Object.assign({
    filename:module.parent.filename,
    scope:{},
    includeGlobals:false,
    proxyGlobal:true,
    workspace: [workspaces.DEFAULT_WORKSPACE]
  }, config);

  config.content = isBuffer(config.content)?config.content.toString():config.content;

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
function _createScript(config, options) {
  if (!isString(config.content)) return config.content;
  const stringScript = Module.wrap(config.content.replace(/^\#\!.*/, ''));
  return new vm.Script(stringScript, options);
}

/**
 * Run the given script in the given sandbox, according to the given config and options.
 *
 * @private
 * @param {Object} config           Config to use.
 * @param {VMScript} script         Script to run.
 * @param {Object|Proxy} sandbox    Sandbox to run in.
 * @param {Object} options          Options for running.
 * @returns {Module}                The module created.
 */
function _runScript(config, script, sandbox, options) {
  const module = new Module(config);

  script.runInContext(sandbox, options)(
    module.exports,
    module.require,
    module,
    module.filename,
    config.basedir || path.dirname(module.filename)
  );

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
  const sandbox = _createSandbox(_config);
  const script = _createScript(_config, options);
  const module = _runScript(config, script, sandbox, options);
  const diff = process.hrtime(time);
  const ms = parseInt((diff[0] * 1000) + (diff[1] / 1000000), 10);

  console.log(`${cache.size} ${c(ms+'ms')} ${y(config.filename)}`);

  return module;
}


module.exports = evaluate;