'use strict';

const vm = require('vm');
const {makeArray, isObject} = require('./util');

const lookup = new Set();
const DEFAULT_WORKSPACE = Symbol('Default Workspace');

/**
 * Create a Proxy for use a sandbox global.
 *
 * @private
 * @param {Array.<Symbol>} ids        The workspaces to apply to the proxy, in order of use.
 * @param {Workspaces} workspaces     The workspaces store.
 * @returns {Proxy}                   The created proxy.
 */
function _createProxy(ids, workspaces) {
  const _workspaces = makeArray(ids).map(id=>{
    if (!workspaces.has(id)) workspaces.set(id, {});
    return workspaces.get(id);
  });

  return new Proxy(global, {
    get: function(target, property, receiver) {
      if (property === 'global') return global;
      for (let n=0; n<_workspaces.length; n++) {
        if (property in _workspaces[n]) return Reflect.get(_workspaces[n], property, receiver);
      }
      return Reflect.get(target, property, receiver);
    },
    has: function(target, property) {
      for (let n=0; n<_workspaces.length; n++) {
        if (property in _workspaces[n]) return true;
      }
      return Reflect.has(target, property);
    },
    set: function(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    }
  });
}

/**
 * Create a unique lookup for the given workspaces array.
 *
 * @param {Array.<Symbol>] ids    Workspaces id.
 * @returns {Array.<Symbol>}      The lookup value, always the same array for same Symbol collection.
 */
function createLookup(ids) {
  for (let value of lookup) {
    if (ids.length === value.length) {
      let match = true;
      value.forEach(subItem=>{
        if (ids[n] !== subItem) match = false;
      });
      if (match) return value;
    }
  }
  return ids;
}

/**
 * Class to store workspaces.
 *
 * @extends Map
 * @class
 */
class Workspaces extends Map {
  /**
   * Get a workspace for the given ids.
   *
   * @param {Array.<Symbol>} [...ids]     The workspaces we are getting a context for.
   * @returns {VMContent}                 The vm context for given workspace.
   */
  get(...ids) {
    const id = (ids.length?((ids.length === 1)?ids[0]:createLookup(ids)):DEFAULT_WORKSPACE);
    if (super.has(id)) return super.get(id);
    super.set(id, vm.createContext(_createProxy(id, this)));
    return super.get(id);
  }

  /**
   * Set a given workspace object.
   *
   * @param {Symbol} id         The workspace id.
   * @param {Object} value      The workspace.
   * @returns {boolean}         Did it set.
   */
  set(id, value) {
    if (typeof id !== 'symbol') throw new TypeError('Workspace ids have to be symbols');
    if (!isObject(value)) throw new TypeError('Workspaces should be objects');
    return super.set(id, value)
  }

  /**
   * Get function for use in module export.  Get a given workspace without creating new ones as with get().
   *
   * @param {Symbol} id       Workspace to get.
   * @returns {Object}        The workspace object for given id.
   */
  exportedGet(id) {
    if (typeof id !== 'symbol') throw new TypeError('Workspace ids have to be symbols');
    return super.get(id);
  }

  /**
   * Reference to default workspace key.
   *
   * @returns {Symbol}
   */
  get DEFAULT_WORKSPACE() {
    return DEFAULT_WORKSPACE;
  }
}

module.exports = new Workspaces();