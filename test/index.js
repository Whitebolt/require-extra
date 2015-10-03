/* jshint node: true, mocha: true */
/* global chai */


'use strict';

var packageInfo = require('../package.json');
var jsDoc = require('./index.json');
var requireX = require('../index.js');
var expect = require('chai').expect;
var path = require('path');
var mockFs = require('mock-fs');


/**
 * Create a mock file systyem for testing purposes.
 *
 * @private
 */
function setupMockFileSystem(){
  var mockFsSetup = {};

  var testModulesDir = __dirname + '/../forTests';
  var nodeModulesDir = __dirname + '/node_modules';
  var nodeModulesParentDir = __dirname + '/../node_modules';

  mockFsSetup[testModulesDir] = {
    'testModule1.js': 'module.exports = {\'testParam\': 1};',
    'testModule2.js': 'module.exports = {\'testParam\': 2};',
    'testModule1-2.js': 'module.exports = {\'testParam\': require(\'./testModule2.js\')};',
    'testModuleWithError.js': 'var error = b/100;module.exports = {\'testParam\': 1};'
  };

  mockFsSetup[nodeModulesDir] = {
    'express': {
      'index.js': 'module.exports = {\'testParam\': \'EXPRESS\'};'
    },
    'socket.io': {
      'package.json': '{"main":"./lib/socket.js"}',
      'lib': {
        'socket.js': 'module.exports = {\'testParam\': \'SOCKET.IO\'};'
      }
    },
    'grunt': {
      'index.js': 'module.exports = {\'testParam\': \'GRUNT-LOCAL\'};'
    },
  };

  mockFsSetup[nodeModulesParentDir] = {
    'gulp': {
      'index.js': 'module.exports = {\'testParam\': \'GULP\'};'
    },
    'grunt': {
      'index.js': 'module.exports = {\'testParam\': \'GRUNT-PARENT\'};'
    },
  };

  mockFs(mockFsSetup);
}


/**
 * Generate a description for a describe clause using the info in an object.
 *
 * @private
 * @param {Object} items        The object to get a description from.
 * @param {string} [itemName]   If supplied the property of items to get from.
 * @returns {string}
 */
function describeItem(items, itemName) {
  if(itemName){
    return items[itemName].name + '(): ' + items[itemName].description;
  }

  return items.name + ': ' + items.description;
}


describe(describeItem(packageInfo), function() {
  setupMockFileSystem();

  it('Should export a function with 3 method: resolve, getModule and getResolver', function() {
    expect(requireX).to.be.a('function');
    ['resolve', 'getModule', 'getResolver'].forEach(function(method) {
      expect(requireX[method]).to.be.a('function');
    });
  });

  describe(describeItem(jsDoc, 'requireAsync'), function() {
    describe('Should load module asynchronously', function() {
      it('Should return the module in node-style callback', function(done) {
        requireX('../forTests/testModule1.js', function(error, testModule1) {
          expect(testModule1.testParam).to.equal(1);
          expect(error).to.equal(null);
          done();
        });
      });

      it('Should resolve the module to returned promise', function(done) {
        requireX('../forTests/testModule1.js').then(function(testModule1) {
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });

      it('Should load dependant modules', function(done) {
        requireX('../forTests/testModule1-2.js').then(function(testModule1) {
          expect(testModule1.testParam.testParam).to.equal(2);
          done();
        });
      });

      it('Should return an error to node-style callback when module not found', function(done) {
        requireX('../forTests/testModule-1.js', function(error, testModule1) {
          expect(error).to.not.equal(null);
          expect(testModule1).to.equal(undefined);
          done();
        });
      });

      it('Should reject the returned promise when module not found', function(done) {
        requireX('../forTests/testModule-1.js').then(null, function(error) {
          expect(error).to.not.equal(null);
          done();
        });
      });
    });

    it('Should reject the promise with error when error occurs in module', function(done) {
      requireX('../forTests/testModuleWithError.js').then(null, function(error) {
        expect(error).to.not.equal(null);
        done();
      });
    });

    describe('Should load an array of modules asynchronously', function() {
      it('Should resolve the modules to returned promise', function(done) {
        requireX([
          '../forTests/testModule1.js',
          '../forTests/testModule2.js'
        ]).spread(function(testModule1, testModule2) {
          expect(testModule1.testParam).to.equal(1);
          expect(testModule2.testParam).to.equal(2);
          done();
        });
      });

      it('Should return modules in callback', function(done) {
        requireX([
          '../forTests/testModule1.js',
          '../forTests/testModule2.js'
        ], function(error, testModule1, testModule2) {
          expect(error).to.equal(null);
          expect(testModule1.testParam).to.equal(1);
          expect(testModule2.testParam).to.equal(2);
          done();
        });
      });
    });

    describe('Should be able to set the base directory manually', function() {
      it('Should be able to set directory to relative path', function(done) {
        requireX({
          dir: '../forTests'
        }, './testModule1.js').then(function(testModule1) {
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });

      it('Should be able to set directory to absolute path', function(done) {
        requireX({
          dir: path.resolve(__dirname + '/../')
        }, './forTests/testModule1.js').then(function(testModule1) {
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });
    });

    describe('Should load modules from node-modules', function() {
      it('Should load a node module', function(done){
        requireX('express').then(function(express) {
          expect(express.testParam).to.equal('EXPRESS');
          done();
        });
      });

      it('Should load a node module when it package.json defines a different main file', function(done){
        requireX('socket.io').then(function(socket) {
          expect(socket.testParam).to.equal('SOCKET.IO');
          done();
        });
      });

      it('Should trace-up the node_module tree to find module', function(done){
        requireX('gulp').then(function(gulp) {
          expect(gulp.testParam).to.equal('GULP');
          done();
        });
      });

      it('Should load the most local module in the node_modules tree', function(done){
        requireX('grunt').then(function(grunt) {
          expect(grunt.testParam).to.equal('GRUNT-LOCAL');
          done();
        });
      });
    });
  });

  describe(describeItem(jsDoc, 'resolveModulePath'), function() {
    it('', function() {
      // STUB
    });
  });

  describe(describeItem(jsDoc, 'getModule'), function() {
    it('', function() {
      // STUB
    });
  });

  describe(describeItem(jsDoc, 'getResolver'), function() {
    it('', function() {
      // STUB
    });
  });
});


