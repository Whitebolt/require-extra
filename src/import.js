'use strict';

const path = require('path');
const settings = require('./settings');
const {
  requireAsync,
  requireSync
} = require('./require');
const {
  isFunction,
  intersection,
  readDir,
  makeArray,
  flattenDeep,
  getCallingFileName,
  getCallingDir,
  lstat,
  chain
} = require('./util');
const cache = require('./cache');
const ErrorEvent = require('./events').Error;

/**
 * Get a list of files in the directory.
 *
 * @private
 * @param {string} dirPath          Directory path to scan.
 * @param {Object} [options]        Import options object.
 * @returns {Promise.<string[]>}    Promise resolving to array of files.
 */
async function _filesInDirectory(dirPath, options) {
  const basedir = options.basedir || getCallingDir();
  const resolvedDirPath = basedir?path.resolve(basedir, dirPath):dirPath;
  let xExt = _getExtensionRegEx(options.extension || settings.get('extensions'));

  try {
    const files = (await readDir(resolvedDirPath));
    if (options.rescursive) {
      const dirs = chain(await Promise.all(chain(files)
        .map(fileName=>path.resolve(resolvedDirPath, fileName))
        .map(async (file)=>{
          const stat = await lstat(file);
          if (stat.isDirectory()) return file;
        })
        .value())).filter(file=>file);
      if (dirs.value().length) files.push(...(await Promise.all(
        dirs.map(dirPath=>_filesInDirectory(dirPath, options)).value()
      )));
    }
    return chain(files)
      .flattenDeep()
      .filter(fileName=>xExt.test(fileName))
      .map(fileName=>path.resolve(resolvedDirPath, fileName))
      .value();
  } catch (err) {
    return [];
  }
}

/**
 * Get all the files in a collection of directories.
 *
 * @param {Array|Set|string} dirPaths     Path(s) to get files from.
 * @param [options]                       Import options object.
 */
async function filesInDirectories(dirPaths, options) {
  let files = await Promise.all(makeArray(dirPaths).map(dirPath=>_filesInDirectory(dirPath, options)));
  return flattenDeep(files);
}

/**
 * Take a file path and return the filename (without an extension).  Possible
 * extensions are passed in or the module default is used.
 *
 * @private
 * @param {string} filePath                               File path to get filename from.
 * @param {Array|string} [ext=config.get('extensions')]   File extension(s) to remove.
 * @returns {string}                                      The filename without given extension(s).
 */
function _getFileName(filePath, ext=settings.get('extensions')) {
  return path.basename(filePath).replace(_getExtensionRegEx(ext), '');
}

/**
 * Get a regular expression for the given selection of file extensions, which
 * will then be able to match file paths, which have those extensions.
 *
 * @private
 * @param {Array|string} [ext=config.get('extensions')]     The extension(s).
 * @returns {RegExp}                                        File path matcher.
 */
function _getExtensionRegEx(ext=settings.get('extensions')) {
  let _ext = '(?:' + makeArray(ext).join('|') + ')';
  return new RegExp(_ext + '$');
}

/**
 * Get the extension names for a given filename
 *
 * @private
 * @param {string} fileName   The filename to get the extension of.
 * @param {Object} [options]  Options containing the file extension (or not).
 * @returns {Array}
 */
function _getFileTests(fileName, options={}) {
  let extension =  makeArray(options.extension || settings.get('extensions'));
  return chain([path.basename(fileName)])
    .concat(extension.map(ext=>path.basename(fileName, ext)))
    .filter(value=>value)
    .uniq()
    .value();
}

/**
 * Can a filename be imported according to the rules the supplied options.
 *
 * @private
 * @param {string} fileName         Filename to test.
 * @param {string} callingFileName  Calling filename (file doing the import).
 * @param {Object} options          Import/Export options.
 * @returns {boolean}
 */
function _canImport(fileName, callingFileName, options) {
  if (callingFileName && (fileName === callingFileName)) return false;
  let _fileName = _getFileTests(fileName, options);
  if (options.includes) return (intersection(options.includes, _fileName).length > 0);
  if (options.excludes) return (intersection(options.includes, _fileName).length === 0);
  return true;
}

/**
 * Import an entire directory (excluding the file that does the import if it is in the same directory).
 *
 * @async
 * @param {string} dirPath                                               Directory to import.
 * @param {Object} [options]                                            Import options.
 * @param {Array|string} [options.extension=config.get('extensions')]   Extension of files to import.
 * @param {Object} [options.imports={}]                                 Object to import into.
 * @param {Function} [options.onload]                                   Callback to fire on each successful import.
 * @param {boolean} [options.merge=false]                               Merge exported properties & methods together.
 * @returns {Promise.<Object>}
 */
async function _importDirectory(dirPath, options={}) {
  const _options = _importDirectoryOptionsParser(options);
  await _importDirectoryModules(dirPath, _options);
  return _options.imports;
}

/**
 * Parse the input options, filling-in any defaults.
 *
 * @private
 * @param {Object} [options={}]   The options to parse.
 * @returns {Object}
 */
function _importDirectoryOptionsParser(options={}) {
  const _options = Object.assign({
    imports: {},
    onload: options.callback,
    extension: makeArray(options.extensions || settings.get('extensions')),
    useSyncRequire: settings.get('useSyncRequire'),
    merge: settings.get('mergeImports'),
    rescursive: false
  }, options, {
    squashErrors: !!options.retry
  });

  if (_options.extensions) delete _options.extensions;

  if (options.callback) console.warn(`The options.callback method is deprecated, please use options.onload() instead. This being used in ${getCallingFileName()}`);

  return _options;
}

/**
 * Take a directory path(s) and pull-in all modules returning an array with the filename as the first item
 * and module as the second
 *
 * @private
 * @async
 * @param {string|Array.<string>} dirPath     Directories to import.
 * @param {Object} options                    Import options.
 * @returns {Promise.<Array>}                 The module definitions.
 */
async function _importDirectoryModules(dirPath, options) {
  const source = ((options.parent || {}).filename || options.parent) || getCallingFileName();
  const files = await filesInDirectories(makeArray(dirPath), options);
  return tryLoading(files, source, options);
}

async function tryLoading(files, source, options, failCount=files.length) {
  const errors = new Map();
  const require = (options.useSyncRequire ? requireSync : requireAsync);
  const retry = [];
  const modDefs = (await Promise.all(files.map(async (target)=>{
    if (!_canImport(target, source, options)) return;
    try {
      if ((options.reload === true) && (cache.has(target))) cache.delete(target);
      const module = await require(options, target);
      if ((options.merge === true) && (!isFunction(module))) {
        Object.assign(options.imports, module);
      } else {
        options.imports[_getFileName(target, options.extension)] = module;
      }
      if (options.onload) options.onload(target, module);
      return [target, module];
    } catch (error) {
      if (!options.squashErrors) throw error
      cache.delete(target);
      retry.push(target);
      if (options.onerror) errors.set(target, error);
      return;
    }
  }))).filter(modDef=>modDef);

  if (!options.squashErrors || !retry.length || (failCount <= retry.length)) {
    if (options.onerror && (failCount <= retry.length) && (options.squashErrors)) {
      (retry || []).forEach(source=>options.onerror(new ErrorEvent({source, error:errors.get(source)})));
    }
    return modDefs;
  }
  return tryLoading(retry, source, options, retry.length).then(_modDefs=>modDefs.concat(_modDefs));
}

/**
 * Import all the modules in a set of given paths,according to the supplied options.
 *
 * @public
 * @param {string|Array.<string>} dirPath   The path(s) to import from.
 * @param {Object} [options='']             The option to use in the import.
 * @param {Function} [callback]             Node-style callback to fire, use if you do not want a promise.
 * @returns {Promise.<Object>}
 */
function importDirectory(dirPath, options, callback) {
  if (!callback) return _importDirectory(dirPath, options);
  _importDirectory(dirPath, options).then(
    imports=>setImmediate(()=>callback(null, imports)),
    err=>setImmediate(()=>callback(err, undefined))
  );
}


module.exports = importDirectory;