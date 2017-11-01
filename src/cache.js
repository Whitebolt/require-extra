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
}

module.exports = new Cache();