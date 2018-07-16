'use strict';

let settings;

const _defaultMemoizeResolver = first=>{
  if (!settings) settings = require('./settings');
  return first;
};

function memoize(fn, resolver=_defaultMemoizeResolver) {
  function memoized(...params) {
    if (!settings) settings = require('./settings');
    if (!settings.get('useCache')) return fn(...params);
    const lookupId = resolver(...params);
    if (memoized.cache.has(lookupId)) {
      const [err, data] = memoized.cache.get(lookupId);
      if (!err) return data;
      throw err;
    }

    try {
      const result = fn(...params);
      memoized.cache.set(lookupId, [null, result]);
      return result;
    } catch (err) {
      memoized.cache.set(lookupId, [err, undefined]);
      throw err;
    }
  }

  memoized.cache = new Map();
  return memoized;
}

function memoizeNode(fn, resolver=_defaultMemoizeResolver) {
  function memoized(...params) {
    if (!settings) settings = require('./settings');
    if (!settings.get('useCache')) return fn(...params);
    const cb = params.pop();
    const lookupId = resolver(...params);
    if (memoized.cache.has(lookupId)) return cb(...memoized.cache.get(lookupId));
    return fn(...params, (...result)=>{
      memoized.cache.set(lookupId, result);
      return cb(...result);
    });
  }

  memoized.cache = new Map();
  return memoized;
}

function memoizePromise(fn, resolver=_defaultMemoizeResolver) {
  function memoized(...params) {
    if (!settings) settings = require('./settings');
    if (!settings.get('useCache')) return fn(...params);
    const lookupId = resolver(...params);
    if (memoized.cache.has(lookupId)) {
      const [err, ...data] = memoized.cache.get(lookupId);
      if (!!err) return Promise.reject(err);
      return Promise.resolve(((data.length > 1) ? data : data[0]));
    }

    return fn(...params).then((...data)=>{
      memoized.cache.set(lookupId, [null, ...data]);
      return ((data.length > 1) ? data : data[0]);
    }, err=>{
      memoized.cache.set(lookupId, [err]);
      return Promise.reject(err);
    });
  }

  memoized.cache = new Map();
  return memoized;
}

function memoizeRegExp(rx) {
  const cache = new Map();

  function getCache(cacheId) {
    if (!cache.has(cacheId)) cache.set(cacheId, new Map());
    return cache.get(cacheId);
  }

  const _rx = new RegExp(rx.source, rx.flags);
  const memoizedTest = memoize(rx.test.bind(rx));
  const replaceCache = getCache('replaceCache');
  const matchCache = getCache('matchCache');
  const execCache = getCache('execCache');


  const memoized = {
    test(value, useCache=true) {
      if (!useCache) return rx.test(value);
      return memoizedTest(value);
    },

    replace(value, replaceString, useCache=true) {
      if (!useCache) return value.replace(rx, replaceString);
      if (!replaceCache.has(value)) replaceCache.set(value, memoize(value.replace.bind(value), (rx, rs)=>rs));
      return replaceCache.get(value)(rx, replaceString);
    },

    match(value, useCache=true) {
      if (!useCache) return value.replace(rx, replaceString);
      if (!matchCache.has(value)) matchCache.set(value, memoize(value.match.bind(value)));
      return matchCache.get(value)(rx);
    },

    exec(value, useCache=true) {
      if (!useCache) return rx.exec(value);
      if (!execCache.has(value)) execCache.set(value, new Map());
      if (!execCache.get(value).has(rx.lastIndex)) {
        execCache.get(value).set(rx.lastIndex, rx.exec(value));
      }
      return execCache.get(value).get(rx.lastIndex);
    },

    clear() {
      cache.forEach(cache=>cache.clear());
    }
  };

  return Object.assign(_rx, memoized);
}

module.exports = {
  memoize, memoizeNode, memoizePromise, memoizeRegExp
};