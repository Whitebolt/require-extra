/* jshint node: true */

'use strict';

var fs = require('fs');
var jsdocParse = require("jsdoc-parse");

function parseJsDoc(src, callback) {
  var txt = '';

  jsdocParse({
    src: src,
    private: true
  }).on('data', function(chunk) {
    txt += chunk.toString();
  }).on('end', function() {
    var data = JSON.parse(
        txt.replace(/(?:[\n\f\r\t ]|\\n|\\r|\\t|\\f)+/g, ' ')
    );
    var functions = {};

    data.forEach(function(item) {
      functions[item.id] = item;
      delete item.id;
    });

    callback(functions);
  });
}

parseJsDoc(__dirname + '/../index.js', function(functions) {
  fs.writeFile('./test/index.json', JSON.stringify(functions), null);
});