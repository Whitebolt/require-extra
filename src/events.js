'use strict';

const listeners = new Map();
const {makeArray, isString} = require('./util');
const Private = require("./Private");


class Event {
  constructor(config) {
    this.type = config.type;
    this.target = config.target;
  }

  get target() {
    return Private.get(this, 'target');
  }

  set target(value) {
    return Private.set(this, 'target', value);
  }

  get type() {
    return Private.get(this, 'type');
  }

  set type(value) {
    return Private.set(this, 'type', value);
  }
}

class Error_Event extends Event {
  constructor(config) {
    super({type:'error', target:config.target});
    this.source = config.source;
    this.error = config.error;
  }

  get source() {
    return Private.get(this, 'source');
  }

  set source(value) {
    return Private.set(this, 'source', value);
  }

  get error() {
    return Private.get(this, 'error');
  }

  set error(value) {
    return Private.set(this, 'error', value);
  }
}

class Loaded_Event extends Event {
  constructor(config) {
    super({type:'loaded', target:config.target});
    this.source = config.source;
    this.duration = config.duration;
  }

  get source() {
    return Private.get(this, 'source');
  }

  set source(value) {
    return Private.set(this, 'source', value);
  }

  get duration() {
    return Private.get(this, 'duration');
  }

  set duration(value) {
    return Private.set(this, 'duration', value);
  }
}

class Evaluated_Event extends Loaded_Event {
  constructor(config) {
    super(config);
    this.type = 'evaluated';
    this.cacheSize = config.cacheSize;
  }

  get cacheSize() {
    return Private.get(this, 'cacheSize');
  }

  set cacheSize(value) {
    return Private.set(this, 'cacheSize', value);
  }
}

class Events {
  on(eventName, listener) {
    const unsubscribes = [];
    makeArray(eventName).forEach(eventName=>{
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(listener);
      unsubscribes.push(()=>listeners.get(eventName).delete(listener));
    });
    return ()=>unsubscribes.forEach(unsubscribe=>unsubscribe());
  }

  once(eventName, listener) {
    let unsubscribe = this.on(eventName, (...data)=>{
      listener(...data);
      unsubscribe();
      unsubscribe = undefined;
    });
  }

  emit(eventName, ...data) {
    [...(listeners.get(eventName) || [])].forEach(listener=>{
      setImmediate(()=>listener(...data));
    });
  }

  remove(listener) {
    if (isString(listener) && listeners.has(listener)) return listeners.get(listener).clear();
    listeners.forEach(listeners=>{
      listeners.forEach(_listener=>{
        if (_listener === listener) listeners.delete(listener);
      })
    });
  }

  get Event() {
    return Event;
  }

  get Error() {
    return Error_Event;
  }

  get Loaded() {
    return Loaded_Event;
  }

  get Evaluated() {
    return Evaluated_Event;
  }
}

module.exports = new Events();
