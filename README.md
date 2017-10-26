# require-extra
[NodeJs](https://nodejs.org) module loading with an asynchronous flavour.  Adds a number of useful functions and extra options not available via native *require()* as well as making it asynchronous.

## Installation

```bash
$ npm install --save require-extra
```

Or

```bash
$ yarn add require-extra
```


## Asynchronous loading

The loader returns a Promise.

**Note:** Whilst module paths are resolved asynchronously and their content loaded, any requires within the module will load in the normal sychronous way (see [roadmap](ROADMAP.md)).

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

## Promises

**Breaking change:** *This module now uses native promises instead of the bluebird-style it used previously.  The reason for this change is to reduce the dependencies and it make the use of async/await seamless.*

The promise type returned can be overriden by setting the promise library.

```javavascript
requireX.set('Promise', require('bluebird'));
```

This will cause all returned promises to be wrapped in the supplied promise library.


## Loading multiple modules at once

The loader can also accept an array of module-id's/paths; this will then load together asynchronously.

```javascript
var requireX = require('require-extra');

requireX.require(['express' , 'socket.io']).spread(function(express, IO){
  console.log('Module express & socket.io has loaded');
}).catch(function(error){
  console.error('Module express or socket.io has failed to load', error);
});
```

**Note:** All modules in the array will load together.  This might not be what you want.  Performance boosts created by caching, where two modules have a shared dependency could be lost.  It is possible in this situation that the dependency will be loaded twice.  In most situations this will not be an issue or not happen but this behaviour should be noted and tested if performance is a big issue.


## Asynchronous require.resolve()

A resolve method is available.  It works just like the native *require.resolve()*, except asynchronously.  The *resolve()* method is a wrapper around [resolve](https://github.com/browserify/resolve).

```javascript
var requireX = require('require-extra');

requireX.resolve('express').then(function(path){
  console.log('Path to express module: ', path);
}, function(error){
  console.error('Failed to find module express');
});
```

**Possible breaking change:** Previously, the library used the [async-resolve](https://github.com/Meettya/async-resolve) library but this has been swapped for a wrapped version of [resolve](https://github.com/browserify/resolve).  The wrapped version supplies all the same methods and properties as the original async-resolve method so no errors should result.


## Passing options to require() and resolve()

An options object can be passed to both require() and require.resolve() as the first argument.

The possible options are:
 1. **resolver:** A resolver class instance for calculating paths (this an object with resolve function like the one available in [async-resolve](https://github.com/Meettya/async-resolve)).
 2. **dir** The route directory to use for starting path calculations.  If this is not supplied then the path is calculated using an algorithm that loops through a stack trace.

```javascript
var requireX = require('require-extra');

requireX({
  dir: '/home/me/.npm',
  resolver: myResolverClass
}'express').then(function(express){
  console.log('Module express has loaded');
}, function(error){
  console.error('Module express, failed to load', error);
});
```

## Creating your own resolver class

The getResolver() method can be used to create a new resolver class instance.  This can be passed back to require or resolve as in the above example.

```javascript
var requireX = require('require-extra');

myResolverClass = requireX.getResolver({
  // default: ['.js', '.json', '.node'] - specify allowed file-types, note that the 
  // order matters. in this example index.js is prioritized over index.coffee 
  extensions: ['.js', '.coffee', '.eco'],
  // default : 'node_modules' - its 'node_modules' directory names, may be changed 
  modules : 'other_modules'
})
```


## Trying multiple paths for a module

The method *try()* will try an array of paths looking for a module until it it finds the requested file.  Module is loaded and returned or a default value (defaults to undefined).

```javascript
var requireX = require('require-extra');

requireX.try(
  ['/somePath', '../some/other/path'], null
).then(function(someModule){
  if(someModule !== null){
    console.log('Module found');
  }else{
    console.warn('Module not found');
  }
}, function(error){
  console.error('Failed loading module', error);
});
```

You can also use the native require by passing ***true*** as the first option to *try*. This is useful if you want to to try different module paths but do not want to use an async require.  The method still returns a promise and the requires are actually done on *nextTick()* but using the native node *require()*.

```javascript
var requireX = require('require-extra');

requireX.try(
  true
  ['/somePath', '../some/other/path'], null
).then(function(someModule){
  if(someModule !== null){
    console.log('Module found');
  }else{
    console.warn('Module not found');
  }
}, function(error){
  console.error('Failed loading module', error);
});
```



## Importing an entire directory
The method *importDirectory()* will import all modules in a directory (excluding the calling module if it is in the same directory).  This is useful when loading order is not important and you want all modules in a specfic folder. Can be used
to reduce config options in large modules, just drop the file in-place and no need to tell it to load.

```javascript
var requireX = require('require-extra');

requireX.importDirectory(
  '/somePath'
).then(function(modules){
  console.log('My module', modules);
}, function(error){
  console.error('Failed loading directory', error);
});
```

Each module is imported into its own property (unless the merge option is set to true, see below).

The second parameter, an options object, allows for greater control over the imports:

 1. **extension:** *\[defaults to \['.js', '.json', '.node'\]\]* Filter for files with this extension.  Defaults to the default for the resolver class (currently node standard of .js, .json, .node). Can pass an array here or a string containing one extension name.
 2. **imports:** *\[defaults to new object\]* Object to import into.
 3. **callback:** Callback to run after each import will fire function(<Filename>, <Imported Module>).
 4. **merge:** *\[defaults to false\]* Whether to merge imorted properties and methods together.
 5. **useSyncRequire** *\[defaults to false\]* Whether to use the native node require or the async version in this module.