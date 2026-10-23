const assert = require('assert');

const { State } = require('gell');

const roles = require('../../../gell-dispatch/middleware/roles');

describe('roles middleware', function() {
    let middleware, event, resumed;

    function resume() {
        resumed = true;

        return 'resumed';
    }

    function invocation(triggerName, triggerSpec={}) {
        return {
            route: `unittest.event#${triggerName}`,
            eventName: 'unittest.event',
            triggerName,
            triggerSpec
        };
    }

    function caller(attributes) {
        const caller_ = new State();
        Object.keys(attributes).forEach(k => caller_.set(k, attributes[k]));

        return caller_;
    }

    function rejection(event) {
        try {
            middleware(event, resume);
        } catch (e) {
            return e;
        }

        assert.fail('should have thrown exception');
    }

    beforeEach(function() {
        middleware = roles();
        resumed = false;
    })

    describe('trigger without roles', function() {
        beforeEach(function() {
            event = { __invocationSpec: invocation('action') };
        })

        it('allows caller with any role', function() {
            event.caller = caller({ role: 'driver' });

            assert.strictEqual(middleware(event, resume), 'resumed');
            assert(resumed);
        })

        it('rejects caller without a role (401)', function() {
            event.caller = caller({});

            const e = rejection(event);

            assert.strictEqual(e.name, 'UnauthorizedError');
            assert.strictEqual(e.status, 401);
            assert(!resumed);
        })

        it('rejects missing caller (401)', function() {
            assert.strictEqual(rejection(event).status, 401);
        })
    })

    describe('trigger with roles', function() {
        beforeEach(function() {
            event = { __invocationSpec: invocation('action', { roles: ['administrator', 'manager'] }) };
        })

        it('allows caller with an allowed role', function() {
            event.caller = caller({ role: 'manager' });

            middleware(event, resume);

            assert(resumed);
        })

        it('rejects caller without an allowed role (403)', function() {
            event.caller = caller({ role: 'driver' });

            const e = rejection(event);

            assert.strictEqual(e.name, 'ForbiddenError');
            assert.strictEqual(e.status, 403);
            assert.strictEqual(e.message, 'call to event trigger (route="unittest.event#action") is not allowed for caller (roles="driver")');
            assert(!resumed);
        })

        it('supports caller with a list of roles', function() {
            event.caller = caller({ roles: ['driver', 'administrator'] });

            middleware(event, resume);

            assert(resumed);
        })

        it('supports plain object caller', function() {
            event.caller = { role: 'administrator' };

            middleware(event, resume);

            assert(resumed);
        })

        it('checks api triggers', function() {
            event.__invocationSpec = invocation('api', { roles: ['administrator'] });
            event.caller = caller({ role: 'driver' });

            assert.strictEqual(rejection(event).status, 403);
        })
    })

    describe('unchecked triggers', function() {
        it('does not check effect triggers', function() {
            event = { __invocationSpec: invocation('effect', { roles: ['administrator'] }) };

            middleware(event, resume);

            assert(resumed);
        })

        it('checks configured triggers only', function() {
            middleware = roles({ triggers: ['job'] });
            event = { __invocationSpec: invocation('action', { roles: ['administrator'] }) };

            middleware(event, resume);

            assert(resumed);
        })
    })

    describe('options', function() {
        it('uses custom rolesOf', function() {
            middleware = roles({ rolesOf: caller => caller.groups });
            event = { caller: { groups: ['administrator'] }, __invocationSpec: invocation('action', { roles: ['administrator'] }) };

            middleware(event, resume);

            assert(resumed);
        })
    })
})
