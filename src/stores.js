'use strict';

const Private = require("./Private");
const Triple_Map = require("./Triple_Map");


function clear(options={}) {
  const {difference, makeArray} = require('./util');
  const {includes=Object.keys(stores),excludes=[]} = options;
  difference(makeArray(includes), ['clear', ...makeArray(excludes)]).forEach(storeName=>{
    const store = stores[storeName];
    if ('clear' in store) {
      try {
        store.clear();
      } catch (err) {}
    }
  });
}

function makeArray(value) {
  if (Array.isArray(value)) return value;
  if ((value === undefined) || (value === null)) return [];
  if (value instanceof Set) return [...value];
  return [value];
}

function getInStore(storeId, key) {
  if (stores.hasOwnProperty(storeId)) {
    if ('get' in stores[storeId]) return stores[storeId].get(...makeArray(key));
  }
}

function setInStore(storeId, key, value) {
  if (stores.hasOwnProperty(storeId)) {
    if ('set' in stores[storeId]) return stores[storeId].set(...makeArray(key), value);
  }
}

function hasInStore(storeId, key) {
  if (stores.hasOwnProperty(storeId)) {
    if ('has' in stores[storeId]) return stores[storeId].has(...makeArray(key));
  }
}

function deleteInStore(storeId, key) {
  if (stores.hasOwnProperty(storeId)) {
    if ('has' in stores[storeId]) return stores[storeId].delete(...makeArray(key));
  }
}

const stores = {
  fileQueue: [],
  statDir: new Map(),
  statFile: new Map(),
  statCache: new Map(),
  lStatCache: new Map(),
  fileCache: new Map(),
  readDirCache: new Map(),
  pathsLookup: new Private(),
  resolveCache: new Triple_Map(),
  clear,
  getInStore,
  setInStore,
  hasInStore,
  deleteInStore
};

module.exports = stores;