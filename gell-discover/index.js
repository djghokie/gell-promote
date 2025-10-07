const requireAll = require('require-all');

const REGEX_JS_FILES = /(.+?)\.js$/;
const REGEX_EXCLUDED_DIRS = /^\.(git)$/;

/**
 * WIP: auto discovery of modules
 *  - returned value is graph of modules
 *      - property names are the path segments to the module file
 *  - this only handles events currently
 *  - unclear yet if there should be a registration callback
 *      - in the meantime, event map is returned
 */
module.exports = function discoverModules(paths) {
    const events = {};

    paths.forEach(path => {
        requireAll({
            dirname: path,
            filter: REGEX_JS_FILES,
            excludeDirs: REGEX_EXCLUDED_DIRS,
            recursive: true,
            resolve: module => {
                const { __metadata } = module;

                if (__metadata && __metadata.name) {
                    // register(module);
                    events[module.__metadata.name] = module;

                    return module;
                }
            }
        });
    })

    return events;
}
