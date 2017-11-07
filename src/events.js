'use strict';

var Private = require("./Private");
var EventEmitter = require('events');
var emitter = new EventEmitter();

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

function Loaded_Event(config) {
  var freezer = _setFreeze(this);
  Event.call(this, config);
  this.type = 'loaded';
  this.source = config.source;
  this.duration = config.duration;
  _doFreeze(this, freezer);
}

Loaded_Event.prototype = Object.create(Event.prototype);
Loaded_Event.prototype.constructor = Loaded_Event;

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
emitter.Evaluated = Evaluated_Event;

module.exports = emitter;
