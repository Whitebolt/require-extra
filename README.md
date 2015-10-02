# require-extra
Asychronous module loading and error handling.

## Installation

```bash
$ npm install require-extra
```

## Asychronous loading

Modules can be loaded asychronously and handled with promises (bluebird style).

```javascript
var loader = require('require-extra');

loader.require('express').then(function(express){
  console.log('Module express has loaded');
}, function(error){
  console.error('Module express, failed to load', error);
});
```

Node-style callbcaks can also be use instead of (or along with) promises.

```javascript
var loader = require('require-extra');

loader.require('express', function(error, express){
  if(error){
    console.error('Module express, failed to load');
  }else{
    console.log('Module express has loaded', error);
  }
});
```

## Loading muliple modules at once

The methods above can be given arrays and then an array of modules will be supplied to the resolved promise.

```javascript
var loader = require('require-extra');

loader.require(['express' , 'socket.io']).then(function([express, IO]){
  console.log('Module express & socket.io has loaded');
}, function(error){
  console.error('Module express or socket.io has failed to load', error);
});
```

## Asychronous require.resolve()

The require method exports a resolve method, which is a wrapper around the resolver from the 'async-resolve
' when executed against the current directory.  Will only return a promise at this stage (node callnback to follow).

```javascript
var loader = require('require-extra');

loader.require.resolve('express').then(function(path){
  console.log('Path to express module: ', path);
}, function(error){
  console.error('Failed to find module express');
});
```

## Trying muliple paths for a module

The method *getModule()* will try an array of paths looking for a module until it it finds the requested file.  Module is loaded and returned or a default value (defaults to false).

```javascript
var loader = require('require-extra');

loader.getModule(['/somePath','../some/other/path'], undefined).then(function(someModule){
  if(someModule !== undefined){
    console.log('Module found');
  }else{
    console.warn('Module not found');
  }
}, function(error){
  console.error('Failed loading module', error);
});
```
