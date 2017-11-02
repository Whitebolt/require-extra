'use strict';

const globalCache = (()=>{
  try {
    return __require.cache;
  } catch (err) {
    return require.cache || Object.create(null);
  }
})();

class Cache {
  get(property) {
    return globalCache[property];
  }

  set(property, value) {
    globalCache[property] = value;
    return true;
  }

  has(property) {
    return (property in globalCache);
  }

  delete(property) {
    if (this.has(property)) {
      delete globalCache[property];
      return true;
    }
    return false;
  }

  get size() {
    return Object.keys(globalCache).length;
  }

  clear() {
    Object.keys(globalCache).forEach(property=>this.delete(property));
    return true;
  }

  get source() {
    return globalCache;
  }
}

module.exports = new Cache();