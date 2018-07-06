'use strict';

let settings

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
      if (!err) return Promise.reject(err);
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

module.exports = {
  memoize, memoizeNode, memoizePromise
};