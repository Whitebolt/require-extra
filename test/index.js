/*jshint node: true, mocha: true */


'use strict';

var packageInfo = require('../package.json');
var jsDoc = require('./index.json');

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
  describe(describeItem(jsDoc, 'requireAsync'), function() {
    it('requireX', function() {
      // STUB
    });
  });
});


