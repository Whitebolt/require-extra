'use strict';

const {isFunction, isObject, omit}  = require('./lodash');

const FAIL = Symbol('FAIL');
const _defaultResolver = first=>first;
const _defaultResolver2 = (first, second)=>[first, second];
const _defaultResolver3 = (first,second,third)=>[first, second, third];


function objectLength(obj) {
	return Object.keys(obj).length;
}

function _memoize(memoized, cache=new Map()) {
	memoized.cache = cache;
	return memoized;
}

function getFromCache(lookupId, cache, cacheParams=1) {
  if (cache.has(lookupId)) {
    const lookupId1 = ((cacheParams=1)?lookupId:lookupId[0]);
    const cache1 = cache.get(lookupId1);
    if (cacheParams === 1) return cache1;
    if (('has' in cache1) && (cache1.has(lookupId[1]))) {
      const cache2 = cache1.get(lookupId[1]);
      if (cacheParams === 2) return cache2;
      if (('has' in cache2) && (cache2.has(lookupId[2]))) return cache2.get(lookupId[2]);
    }
  }
  return FAIL;
}

function setCache(lookupId, value, cache, cacheParams=1) {
  if (cacheParams === 1) return cache.set(lookupId, value);
  if (!cache.has(lookupId[0])) cache.set(lookupId[0], new Map());
  if (cacheParams === 2) return cache.get(lookupId[0]).set(lookupId[1], value);
  if (!cache.get(lookupId[0]).has(lookupId[1])) cache.get(lookupId[0]).set(lookupId[1], new Map());
  return cache.get(lookupId[0]).get(lookupId[1]).set(lookupId[2], value);
}

function parseOptions(options={}) {
  const {
    resolver=_defaultResolver,
    cache=new Map(),
    noCache=()=>false,
    cacheParams=1
  } = (isFunction(options) ? {resolver:options} : options);

  if ((cacheParams < 2) || (resolver !== _defaultResolver)) return {resolver, cache, noCache, cacheParams};
  if ((cacheParams === 2) && (resolver === _defaultResolver)) return {resolver:_defaultResolver2, cache, noCache, cacheParams};
  if ((cacheParams > 2) && (resolver === _defaultResolver)) return {resolver:_defaultResolver3, cache, noCache, cacheParams};
}

function memoize(fn, options) {
	const {resolver, cache, noCache, cacheParams} = parseOptions(options);

	function memoized(...params) {
		const fnOptions = params[params.length-1];
		if (!!fnOptions && isObject(fnOptions) && !!fnOptions.noCache) {
			const _fnOptions = omit(params.pop(), ['noCache']);
			if (objectLength(_fnOptions) > 1) return fn(...params, omit(_fnOptions, ['noCache']));
			return fn(...params);
		}
    if (noCache()) return fn(...params);

		const lookupId = resolver(...params);
    const saved = getFromCache(lookupId, memoized.cache, cacheParams);
		if (saved !== FAIL) {
			const [err, data] = saved;
			if (!err) return data;
			throw err;
		}

		try {
			const result = fn(...params);
      setCache(lookupId, [null, result], memoized.cache, cacheParams);
			return result;
		} catch (err) {
      setCache(lookupId, [err, undefined], memoized.cache, cacheParams);
			throw err;
		}
	}
	return _memoize(memoized, cache);
}

function memoizeNode(fn, options={}) {
  const {resolver, cache, noCache, cacheParams} = parseOptions(options);

	function memoized(...params) {
		const cb = params.pop();
		const fnOptions = params[params.length-1];
		if (!!fnOptions && isObject(fnOptions) && !!fnOptions.noCache) {
			const _fnOptions = omit(params.pop(), ['noCache']);
			if (objectLength(_fnOptions) > 1) return fn(...params, omit(_fnOptions, ['noCache']), cb);
			return fn(...params, cb);
		}
    if (noCache()) return fn(...params, cb);

		const lookupId = resolver(...params);
    const saved = getFromCache(lookupId, memoized.cache, cacheParams);
		if (saved !== FAIL) return cb(...saved);
		return fn(...params, (...result)=>{
      setCache(lookupId, result, memoized.cache, cacheParams);
			return cb(...result);
		});
	}
	return _memoize(memoized, cache);
}

function memoizePromise(fn, options={}) {
  const {resolver, cache, noCache, cacheParams} = parseOptions(options);

	function memoized(...params) {
		const fnOptions = params[params.length-1];
		if (!!fnOptions && isObject(fnOptions) && !!fnOptions.noCache) {
			const _fnOptions = omit(params.pop(), ['noCache']);
			if (objectLength(_fnOptions) > 1) return fn(...params, omit(_fnOptions, ['noCache']));
			return fn(...params);
		}
    if (noCache()) return fn(...params);

		const lookupId = resolver(...params);
    const saved = getFromCache(lookupId, memoized.cache, cacheParams);
		if (saved !== FAIL) {
			const [err, ...data] = saved;
			if (!!err) return Promise.reject(err);
			return Promise.resolve(((data.length > 1) ? data : data[0]));
		}

		return fn(...params).then((...data)=>{
      setCache(lookupId, [null, ...data], memoized.cache, cacheParams);
			return ((data.length > 1) ? data : data[0]);
		}, err=>{
      setCache(lookupId, [err], memoized.cache, cacheParams);
			return Promise.reject(err);
		});
	}
	return _memoize(memoized, cache);
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