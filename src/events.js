'use strict';

var EventEmitter = require('events');

function AsyncEventEmitter() {
  EventEmitter.apply(this, arguments);

  var parentEmit = this.emit;

  this.emit = function() {
    var eventName = arguments[0];
    var event = arguments[1];
    if ((event === undefined) || !(event instanceof Event) || event.sync) return parentEmit.apply(this, arguments);

    var args = Array.prototype.slice.call(arguments, 1);
    var listeners = this.listeners(eventName);

    function next(listener) {
      return Promise.resolve(listener.apply(this, args)).then(function() {
        return (listeners.length ? next(listeners.shift()) : Promise.resolve());
      });
    }

    if (listeners.length) return next(listeners.shift());
    return Promise.resolve();
  };
}

AsyncEventEmitter.prototype = Object.create(EventEmitter.prototype);
AsyncEventEmitter.prototype.constructor = AsyncEventEmitter;


var emitter = new AsyncEventEmitter();

function _setFreeze(instance) {
  var freezer = {freeze:false};
  if (!instance.freeze) {
    instance.freeze = true;
    freezer.freeze = true;
  }
  return freezer;
}

function _doFreeze(instance, freezer) {
  if (freezer.freeze) {
    delete instance.freeze;
    if (Object.freeze) Object.freeze(instance);
  }
}

function Event(config) {
  var freezer = _setFreeze(this);
  this.type = config.type || 'event';
  this.target = config.target;
  this.sync = !!config.sync;
  _doFreeze(this, freezer);
}

function Error_Event(config) {
  var freezer = _setFreeze(this);
  Event.call(this, config);
  this.type = 'error';
  this.source = config.source;
  this.error = config.error;

  var _ignored = false;
  this.ignored = function(ignored) {
    if (ignored !== undefined) _ignored = !!ignored;
    return _ignored;
  };
  _doFreeze(this, freezer);
}

Error_Event.prototype = Object.create(Event.prototype);
Error_Event.prototype.constructor = Error_Event;

function Load_Event(config) {
  var freezer = _setFreeze(this);
  Event.call(this, config);
  this.type = 'load';
  this.source = config.source;
  _doFreeze(this, freezer);
}

Load_Event.prototype = Object.create(Event.prototype);
Load_Event.prototype.constructor = Load_Event;

function Loaded_Event(config) {
  var freezer = _setFreeze(this);
  Event.call(this, config);
  this.type = 'loaded';
  this.source = config.source;
  this.duration = config.duration;
  this.size = config.size;
  _doFreeze(this, freezer);
}

Loaded_Event.prototype = Object.create(Event.prototype);
Loaded_Event.prototype.constructor = Loaded_Event;

function Evaluate_Event(config) {
  var freezer = _setFreeze(this);
  Loaded_Event.call(this, config);
  this.type = 'evaluate';
  this.moduleConfig = config.moduleConfig;
  this.parserOptions = config.parserOptions;
  this.data = {};
  _doFreeze(this, freezer);
}

Evaluate_Event.prototype = Object.create(Event.prototype);
Evaluate_Event.prototype.constructor = Evaluate_Event;

function Evaluated_Event(config) {
  var freezer = _setFreeze(this);
  Loaded_Event.call(this, config);
  this.type = 'evaluated';
  this.cacheSize = config.cacheSize;
  _doFreeze(this, freezer);
}

Evaluated_Event.prototype = Object.create(Loaded_Event.prototype);
Evaluated_Event.prototype.constructor = Evaluated_Event;

emitter.Event = Event;
emitter.Error = Error_Event;
emitter.Loaded = Loaded_Event;
emitter.Load = Load_Event;
emitter.Evaluate = Evaluate_Event;
emitter.Evaluated = Evaluated_Event;

module.exports = emitter;
