'use strict';

module.exports = function(importDirectory) {
  return importDirectory('./', {
    basedir: __dirname,
    parent: __filename
  });
};