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

const stores = {
  fileQueue: [],
  statDir: new Map(),
  statFile: new Map(),
  statCache: new Map(),
  lStatCache: new Map(),
  fileCache: new Map(),
  pathsLookup: new Private(),
  resolveCache: new Triple_Map(),
  clear
};

module.exports = stores;