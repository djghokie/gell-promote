const assert = require('assert');
const _ = require('lodash');

/**
 * Returns a copy of an event/snapshot module with allowed roles defined on its externally reachable triggers
 *  - used to restrict framework (gell) modules, which don't define application roles, when registering them with an application
 *  - the original module is not modified
 *
 * @param {*} module event/snapshot module with __metadata
 * @param {*} roles allowed roles (see gell-dispatch/middleware/roles)
 * @param {*} triggers names of triggers to restrict (only those defined by the module are restricted)
 */
module.exports = function restrict(module, roles, triggers=['action', 'api']) {
    assert(module && module.__metadata, 'module with __metadata is required');
    assert(_.isArray(roles) && roles.length > 0, 'roles are required');

    const __metadata = _.cloneDeep(module.__metadata);
    const definedTriggers = __metadata.triggers || {};

    triggers.forEach(name => {
        if (_.isFunction(module[name])) definedTriggers[name] = { ...definedTriggers[name], roles: [...roles] };
    });

    __metadata.triggers = definedTriggers;

    return { ...module, __metadata };
}
