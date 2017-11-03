'use strict';

const vm = require('vm');
const {makeArray, isObject} = require('./util');

const lookup = new Set();
const DEFAULT_WORKSPACE = Symbol('Default Workspace');

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

function createLookup(ids) {
  for (let value of lookup) {
    if (ids.length === value.length) {
      let match = true;
      value.forEach(subItem=>{
        if (!ids.includes(subItem)) match = false;
      });
      if (match) return value;
    }
  }
  return ids;
}

class Workspaces extends Map {
  get(...ids) {
    const id = (ids.length?((ids.length === 1)?ids[0]:createLookup(ids)):DEFAULT_WORKSPACE);
    if (super.has(id)) return super.get(id);
    super.set(id, vm.createContext(_createProxy(id, this)));
    return super.get(id);
  }

  set(id, value) {
    if (typeof id !== 'symbol') throw new TypeError('Workspace ids have to be symbols');
    if (!isObject(value)) throw new TypeError('Workspaces should be objects');
    return super.set(id, value)
  }

  exportedGet(id) {
    if (typeof id !== 'symbol') throw new TypeError('Workspace ids have to be symbols');
    return super.get(id);
  }

  get DEFAULT_WORKSPACE() {
    return DEFAULT_WORKSPACE;
  }
}

module.exports = new Workspaces();