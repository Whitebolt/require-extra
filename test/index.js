/* jshint node: true, mocha: true */
/* global chai */
'use strict';

require(process.cwd() + '/lib/importSettings')('gulp', ['name', 'main'], {main:'./index.js'});

const packageInfo = require(__cwd + 'package.json');
const jsDoc = require(__cwd + gulpSettings.tests + '/forTests/index.json');
const expect = require('chai').expect;
const path = require('path');
const requireX = require('../index.js');


/**
 * Generate a description for a describe clause using the info in an object.
 *
 * @private
 * @param {Object} items        The object to get a description from.
 * @param {string} [itemName]   If supplied the property of items to get from.
 * @returns {string}
 */
function describeItem(items, itemName) {
  try {
    if (itemName) return items[itemName].name + '(): ' + items[itemName].description;
    return items.name + ': ' + items.description;
  } catch(err) {
    return '';
  }
}


describe(describeItem(packageInfo), ()=>{
  it('Should export a function with 3 method: resolve, getModule and getResolver', ()=>{
    expect(requireX).to.be.a('function');
    ['resolve', 'getModule', 'getResolver'].forEach(method=>{
      expect(requireX[method]).to.be.a('function');
    });
  });

  describe(describeItem(jsDoc, 'requireAsync'), ()=>{
    describe('Should load module asynchronously', ()=>{
      it('Should return the module in node-style callback', done=>{
        requireX('./forTests/testModule1.js', (error, testModule1)=>{
          expect(testModule1.testParam).to.equal(1);
          expect(error).to.equal(null);
          done();
        });
      });

      it('Should resolve the module to returned promise', done=>{
        requireX('./forTests/testModule1.js').then(testModule1=>{
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });

      it('Should load dependant modules', function(done) {
        this.timeout(5000);
        requireX('./forTests/testModule1-2.js').then(testModule1=>{
          //consoled.log('HELLO');

          expect(testModule1.testParam.testParam).to.equal(2);
          done();
        });
      });

      it('Should return an error to node-style callback when module not found', done=>{
        requireX('./forTests/testModule-1.js', (error, testModule1)=>{
          expect(error).to.not.equal(null);
          expect(testModule1).to.equal(undefined);
          done();
        });
      });

      it('Should reject the returned promise when module not found', done=>{
        requireX('./forTests/testModule-1.js').then(null, error=>{
          expect(error).to.not.equal(null);
          done();
        });
      });
    });

    it('Should reject the promise with error when error occurs in module', done=>{
      requireX('./forTests/testModuleWithError.js').then(null, error=>{
        expect(error).to.not.equal(null);
        done();
      });
    });

    describe('Should load an array of modules asynchronously', ()=>{
      it('Should resolve the modules to returned promise', done=>{
        requireX([
          './forTests/testModule1.js',
          './forTests/testModule2.js'
        ]).spread((testModule1, testModule2)=>{
          expect(testModule1.testParam).to.equal(1);
          expect(testModule2.testParam).to.equal(2);
          done();
        });
      });

      it('Should return modules in callback', done=>{
        requireX([
          './forTests/testModule1.js',
          './forTests/testModule2.js'
        ], (error, testModule1, testModule2)=>{
          expect(error).to.equal(null);
          expect(testModule1.testParam).to.equal(1);
          expect(testModule2.testParam).to.equal(2);
          done();
        });
      });
    });

    describe('Should be able to set the base directory manually', ()=>{
      it('Should be able to set directory to relative path', done=>{
        requireX({
          dir: './forTests'
        }, './testModule1.js').then(testModule1=>{
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });

      it('Should be able to set directory to absolute path', done=>{
        requireX({
          dir: path.resolve(__dirname)
        }, './forTests/testModule1.js').then(testModule1=>{
          expect(testModule1.testParam).to.equal(1);
          done();
        });
      });
    });

    describe('Should load modules from node-modules', ()=>{
      it('Should load a node module', done=>{
        requireX('express').then(express=>{
          expect(express.testParam).to.equal('EXPRESS');
          done();
        });
      });

      it('Should load a node module when it package.json defines a different main file', done=>{
        requireX('socket.io').then(socket=>{
          expect(socket.testParam).to.equal('SOCKET.IO');
          done();
        });
      });

      it('Should trace-up the node_module tree to find module', done=>{
        requireX('gulp').then(gulp=>{
          expect(gulp.testParam).to.equal('GULP');
          done();
        });
      });

      it('Should load the most local module in the node_modules tree', done=>{
        requireX('grunt').then(grunt=>{
          expect(grunt.testParam).to.equal('GRUNT-LOCAL');
          done();
        });
      });
    });
  });

  describe(describeItem(jsDoc, 'resolveModulePath'), ()=>{
    it('', ()=>{
      // STUB
    });
  });

  describe(describeItem(jsDoc, 'getModule'), ()=>{
    it('', ()=>{
      // STUB
    });
  });

  describe(describeItem(jsDoc, 'getResolver'), ()=>{
    it('', ()=>{
      // STUB
    });
  });

  describe(describeItem(jsDoc, 'importDirectory'), ()=>{
    it('', ()=>{
      // STUB
    });
  });
});


