const assert = require('assert');
const _ = require('lodash');

const format = require('gell/state/format');

const ErrorState = require('../../gell/error');

const MESSAGE = 'call to event trigger (route="%s") is not authorized';

module.exports = async function(event, resume) {
    const { caller, __invocationSpec } = event;

    if (!__invocationSpec) return resume(event);

    assert(caller, 'no caller associated with event');

    const { triggerSpec={}, route } = __invocationSpec;

    const roles = caller.snapshotAttribute('roles') || [];
    let allowedRoles = triggerSpec.roles || [];

    if (_.isString(allowedRoles)) {
        if (allowedRoles === '*' && roles.length > 0) return resume(event);

        allowedRoles = [allowedRoles];
    }

    if (_.intersection(roles, allowedRoles).length === 0) {
        const e = new ErrorState();
        e.set('name', 'AuthorizationError');
        e.set('route', route);
        e.set('message', format(MESSAGE, 'route'));

        e.throw();
    }

    return resume(event);
}
