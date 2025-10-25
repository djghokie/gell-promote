const assert = require('assert');

const registry = require('./domain/registry');

/**
 * WIP: this won't work as the webpack require.context feature needs literals passed to it
 */
module.exports = function discoverModules(paths=[], require) {
    const registry_ = registry.materialize();

    return registry_;
}
