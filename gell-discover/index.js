const assert = require('assert');

const requireAll = require('require-all');

const registry = require('./domain/registry');
const event = require('./domain/event');
const type = require('./domain/type');

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
    registry_.__events = {};

    paths.forEach(path => {
        // console.debug('#####', path);

        requireAll({
            dirname: path,
            filter: REGEX_JS_FILES,
            excludeDirs: REGEX_EXCLUDED_DIRS,
            recursive: true,
            resolve: module => {
                const { __metadata, model } = module;

                // console.debug('#####', __metadata);

                if (__metadata && __metadata.name) {
                    const name = __metadata.name;

                    // register(module);
                    if (module.action)
                        registry_.__events[name] = module;

                    registry_.set(name, event.materialize(__metadata));

                    return module;
                }

                /**
                 * WIP: support legacy type definitions
                 *  - no __metadata attribute
                 * 
                 * WIP: this should be compiling the type
                 *  - inherited attributes
                 *  - suitable for storing with state
                 */
                if (model) {
                    const name = model.name;
                    assert(name);

                    registry_.set(name, type.materialize(model));

                    return module;
                }
            }
        });
    })

    return registry_;
}
