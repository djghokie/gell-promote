const assert = require('assert');

const requireAll = require('require-all');

const registry = require('./domain/registry');

const REGEX_JS_FILES = /(.+?)\.js$/;
const REGEX_EXCLUDED_DIRS = /^\.(git)$/;

/**
 * WIP: auto discovery of modules
 *  - returned value of requireAll is graph of modules
 *      - property names are the path segments to the module file
 *  - this only handles events currently
 *  - unclear yet if there should be a registration callback
 *      - in the meantime, event map is returned
 *  - __events is temporary way to expose the event modules
 *      - this is needed to register events with $bus
 */
module.exports = function discoverModules(paths=[]) {
    const registry_ = registry.materialize();

    paths.forEach(path => {
        // console.debug('#####', path);

        requireAll({
            dirname: path,
            filter: REGEX_JS_FILES,
            excludeDirs: REGEX_EXCLUDED_DIRS,
            recursive: true,
            resolve: module => registry_.register(module)
        });
    })

    return registry_;
}
