const assert = require('assert');
const _ = require('lodash');

const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const MESSAGE_UNAUTHORIZED = 'call to event trigger (route="%s") requires an authorized caller';
const MESSAGE_FORBIDDEN = 'call to event trigger (route="%s") is not allowed for caller (roles="%s")';

/**
 * Returns the roles of a caller
 *  - supports a single "role" (e.g. browser session) or a list of "roles" (e.g. USER)
 */
function callerRoles(caller) {
    if (!caller) return [];

    const attribute = name => _.isFunction(caller.snapshotAttribute) ? caller.snapshotAttribute(name) : caller[name];

    const roles = attribute('roles');
    if (_.isArray(roles)) return roles;

    const role = attribute('role');

    return role ? [role] : [];
}

function throwError(name, status, route, message, roles) {
    const e = new ErrorState();
    e.set('name', name);
    e.set('status', status);
    e.set('route', route);
    if (roles) e.set('roles', roles.join(','));
    e.set('message', format(message, 'route', 'roles'));

    e.throw();
}

/**
 * gell-dispatch middleware that authorizes callers based on the roles allowed by the event trigger metadata
 *  - allowed roles are defined by the "roles" attribute of the trigger (e.g. __metadata.triggers.action.roles)
 *  - only checks triggers reachable by external callers (default: action, api)
 *  - caller without a role is rejected (401)
 *  - triggers without "roles" allow any caller with a role
 *  - caller without an allowed role is rejected (403)
 *
 * WIP: supports roles only; authorization based on the caller's relationship to the data (e.g. "own" DRIVER) is up to the event
 *
 * @param {*} options
 *  - triggers: names of triggers to authorize
 *  - rolesOf: function returning the roles of a caller
 */
module.exports = function({ triggers=['action', 'api'], rolesOf=callerRoles }={}) {
    assert(_.isArray(triggers), 'triggers must be an array');
    assert(_.isFunction(rolesOf), 'rolesOf must be a function');

    return function(event, resume) {
        const { caller, __invocationSpec } = event;

        assert(__invocationSpec, 'invocation spec is required');

        const { route, triggerName, triggerSpec } = __invocationSpec;

        if (!triggers.includes(triggerName)) return resume(event);

        const roles = rolesOf(caller);

        if (roles.length === 0) throwError('UnauthorizedError', 401, route, MESSAGE_UNAUTHORIZED);

        const allowed = triggerSpec.roles;

        if (allowed && !roles.some(r => allowed.includes(r))) throwError('ForbiddenError', 403, route, MESSAGE_FORBIDDEN, roles);

        return resume(event);
    }
}

module.exports.callerRoles = callerRoles;
