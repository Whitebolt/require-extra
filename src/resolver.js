'use strict';

const config = require('./config');
const {uniq, flattenDeep} = require('./util');

/**
 * Generate a new resolver object following specific rules defined in the
 * options parameter. If no options are supplied, return a default resolver.
 *
 * @public
 * @param {Object} options    Options to pass to the resolver object
 * @returns {Object}          The new resolver object or the current module
 *                            resolver if no options supplied.
 */
function getResolver(options={}) {
  const _options = Object.assign({
    extensions: config.get('extensions'),
    moduleDirectory: options.moduleDirectory || options.modules || config.get('moduleDirectory'),
    preserveSymlinks: false
  }, options);

  return {
    resolve: (moduleId, dir, cb)=>{
      const resolver = config.get('resolver');
      if (cb) {
        return resolver(moduleId, Object.assign(_options, {basedir:dir || __dirname}), cb);
      } else {
        return new Promise((resolve, reject)=>{
          resolver(moduleId, Object.assign(_options, {basedir:dir || __dirname}), (err, results)=>{
            if (err) return reject(err);
            return resolve(results);
          });
        })
      }
    },
    addExtensions: (...ext)=>{
      _options.extensions.push(...flattenDeep(ext));
      _options.extensions = uniq(_options.extensions);
      return  _options.extensions;
    },
    removeExtensions: (...ext)=>{
      flattenDeep(ext).forEach(ext=>{
        _options.extensions = _options.extensions.filter(_ext=>(ext !== _ext))
      });
      return  _options.extensions;
    },
    getState: ()=>Object.assign({}, _options),
    isCoreModule: moduleId=>!!config.get('resolver').isCore(moduleId)
  }
}

module.exports = getResolver;
