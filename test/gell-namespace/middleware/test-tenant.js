const assert = require('assert');

const { init } = require('gell/future');
const runtime = require('../../../gell-runtime/mocha');
const resolver = require('gell-session/dispatch/resolver');

const MockStore = require('../../../gell-aws-dynamodb/mock/store');
const bus = require('gell-dispatch/bus');
const attributes = require('gell-dispatch/middleware/attributes');
const { Types } = require('../../../gell-discover/domain/types');
const browser = require('../../../gell-web/domain/browser');

const tenant = require('../../../gell-namespace/domain/tenant');

const tenantMiddleware = require('../../../gell-namespace/middleware/tenant');

const TENANT_ID = 'TEST:TENANT';

const tenantIdOf = caller => caller?.snapshotAttribute('tenantId');

describe('tenant context middleware', function() {
    before(runtime.beforeAll);

    let middleware, resumed;

    function resume(event) {
        resumed = event;

        return event;
    }

    function caller(tenantId) {
        return browser.materialize({ userId: 'user@test.com', tenantId });
    }

    // NOTE: triggerSpec mirrors what gell-dispatch/bus provides from the event module's __metadata
    function event(tenantId, triggerSpec={ context: { tenant_: 'state' } }, context={}) {
        return {
            caller: caller(tenantId),
            context,
            deps: this.deps.branch(),
            __invocationSpec: { route: 'unittest.tenant#action', triggerSpec }
        };
    }

    beforeEach(async function() {
        const types = new Types();
        types.register(tenant.TYPE, tenant.model);

        const store = new MockStore('type', 'id');

        this.deps.define('types', types);
        this.deps.define('store', store);

        await store.save(tenant.materialize({ id: TENANT_ID, name: 'Test Tenant' }));

        middleware = tenantMiddleware(tenantIdOf);
        resumed = undefined;

        this.event = event.bind(this);
    })

    describe('creation', function() {
        it('requires a TENANT id function', function() {
            assert.throws(() => tenantMiddleware(), /tenantIdOf is required/);
        })
    })

    describe('trigger declaring tenant_', function() {
        it('puts the caller TENANT on the context', async function() {
            await middleware(this.event(TENANT_ID), resume);

            const { tenant_ } = resumed.context;

            assert(tenant_, 'tenant_ should be on the context');
            assert.strictEqual(tenant_.snapshotAttribute('id'), TENANT_ID);
            assert.strictEqual(tenant_.snapshotAttribute('name'), 'Test Tenant');
        })

        it('uses a custom context key', async function() {
            const m = tenantMiddleware(tenantIdOf, 'org_');

            await m(this.event(TENANT_ID, { context: { org_: 'state' } }), resume);

            assert.strictEqual(resumed.context.org_.snapshotAttribute('id'), TENANT_ID);
            assert.strictEqual(resumed.context.tenant_, undefined);
        })

        it('fails when the caller TENANT is not persisted', async function() {
            await assert.rejects(middleware(this.event('TEST:MISSING'), resume));
        })

        it('rejects a non-string TENANT id', async function() {
            const m = tenantMiddleware(() => 123);

            await assert.rejects(m(this.event(TENANT_ID), resume), /must be a string/);
        })
    })

    describe('passes the event through unchanged', function() {
        it('when the trigger does not declare tenant_', async function() {
            await middleware(this.event(TENANT_ID, {}), resume);

            assert.strictEqual(resumed.context.tenant_, undefined);
        })

        it('when the context already has tenant_', async function() {
            const tenant_ = tenant.materialize({ id: 'TEST:OTHER' });

            await middleware(this.event(TENANT_ID, undefined, { tenant_ }), resume);

            assert.strictEqual(resumed.context.tenant_, tenant_);
        })

        it('when the caller has no TENANT', async function() {
            await middleware(this.event(undefined), resume);

            assert.strictEqual(resumed.context.tenant_, undefined);
        })
    })

    describe('on the dispatch bus', function() {
        let $bus;

        beforeEach(function() {
            const events = {
                'unittest.tenant': {
                    __metadata: {
                        name: 'unittest.tenant',
                        triggers: { action: { context: { tenant_: 'state' } } }
                    },
                    action: async function({ context }) {
                        return context.tenant_.snapshotAttribute('id');
                    }
                }
            };

            const [$resolver] = init(resolver.object(events));

            [$bus] = init(bus($resolver, [middleware, attributes], this.deps));
        })

        it('the trigger runs with the caller TENANT', async function() {
            const result = await $bus.next({
                route: 'unittest.tenant#action',
                caller: caller(TENANT_ID),
                deps: this.deps
            }).value;

            assert.strictEqual(result, TENANT_ID);
        })

        it('a caller without a TENANT is rejected by the attributes middleware', async function() {
            await assert.rejects($bus.next({
                route: 'unittest.tenant#action',
                caller: caller(undefined),
                deps: this.deps
            }).value);
        })
    })
})
