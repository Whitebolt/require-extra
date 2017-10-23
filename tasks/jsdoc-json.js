'use strict';

const fs = require('fs');

/**
 * Parse an input file for jsDoc and put json results in give output file.
 *
 * @param {string} filePath			File path to parse jsDoc from.
 * @param {Object} jsdoc			The jsdoc class.
 * @returns {Promise.<Object>}		Parsed jsDoc data.
 */
function parseJsDoc(filePath, jsdoc) {
  return jsdoc.explain({files:[filePath]}).then(items=>{
    const data = {};
    items.forEach(item=>{
      if (!item.undocumented && !data.hasOwnProperty(item.longname)) {
        data[item.longname] =  {
          name: item.name,
          description: item.classdesc || item.description
        };
      }
    });

    return data;
  });
}

/**
 * A promisified version of node native fs.write() for basic text content.
 *
 * @param {string} filepath		The path to write to.
 * @param {string} contents		The contents to write to filepath.
 * @returns {Promise}
 */
function write(filepath, contents) {
  return new Promise((resolve, reject)=>{
    fs.writeFile(filepath, contents, (err, response)=>{
      if (err) return reject(err);
      return resolve(response);
    })
  });
}

function fn(gulp, done) {
  if (gulpSettings.nodeVersion >= 4.2) {
    const jsdoc = require('jsdoc-api');
    parseJsDoc(__cwd + gulpSettings.main, jsdoc).then(data=>
      write(__cwd + gulpSettings.tests + '/forTests/index.json', JSON.stringify(data))
    ).then(done);
  } else {
    console.log('Jsdoc-api module does not work in node < 4.2.  This means no nice print-outs in test suits.');
    done();
  }
}

module.exports = {deps: [], fn};