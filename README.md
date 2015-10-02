# require-extra
[NodeJs](https://nodejs.org) module loading with an asychronous flavour.  Adds a number of useful functions and extra options not available via native *require()* as well as making it asychronous.

## Installation

```bash
$ npm install require-extra
```

## Asychronous loading

The loader returns a [Bluebird](https://github.com/petkaantonov/bluebird) style promise.  All the methods and functionality of the bluebird library are available.

**Note:** Whilst module paths are resolved asychronously and their content loaded, any requires within the module will load in the normal sychronous way (see [roadmap](ROADMAP.md)).

```javascript
var requireX = require('require-extra');

requireX('express').then(function(express){
  console.log('Module express has loaded');
}, function(error){
  console.error('Module express, failed to load', error);
});
```

Callbacks following the standard node style can be used instead of (or as well as) promises.

```javascript
var requireX = require('require-extra');

requireX('express', function(error, express){
  if(error){
    console.error('Module express, failed to load');
  }else{
    console.log('Module express has loaded', error);
  }
});
```

## Loading muliple modules at once

The loader can also accept an array of module-id's/paths; this will then load together asychronously.

**Note:** All modules in the array will load togeter.  This might not be what you want.  Performance boosts created by caching, where two modules have a shared dependancy could be lost.  It is possible in this situation that the dependancy will be loaded twice (see [roadmap](ROADMAP.md)).  In most situations this will not be an issue or not happen but this behaviour should be noted and tested if performance is a big issue.

```javascript
var requireX = require('require-extra');

requireX.require(['express' , 'socket.io']).spread(function(express, IO){
  console.log('Module express & socket.io has loaded');
}).catch(function(error){
  console.error('Module express or socket.io has failed to load', error);
});
```

## Asychronous require.resolve()

A resolve method is available.  It works just like the native *require.resolve()*, except asychronously.  The *resolve()* method is a wrapper around the [async-resolve](https://github.com/Meettya/async-resolve) resolve() method.

**Note:** Will only return a promise at this stage (node callnback to follow - see [roadmap](ROADMAP.md)).

```javascript
var requireX = require('require-extra');

requireX.resolve('express').then(function(path){
  console.log('Path to express module: ', path);
}, function(error){
  console.error('Failed to find module express');
});
```

## Trying muliple paths for a module

The method *getModule()* will try an array of paths looking for a module until it it finds the requested file.  Module is loaded and returned or a default value (defaults to false).

```javascript
var requireX = require('require-extra');

requireX.getModule(['/somePath', '../some/other/path'], null).then(function(someModule){
  if(someModule !== null){
    console.log('Module found');
  }else{
    console.warn('Module not found');
  }
}, function(error){
  console.error('Failed loading module', error);
});
```
