const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');
const runtime = require('gell-runtime/mocha');
const resolver = require('gell-session/dispatch/resolver');

const bus = require('../../../gell-dispatch/bus');
const { Types } = require('../../../gell-discover/domain/types');
const browser = require('../../../gell-web/domain/browser');

const typesMiddleware = require('../../../gell-namespace/middleware/types');

const TYPE = 'UNITTEST#ITEM';
const model = { attributes: { type: { type: 'string', default: TYPE } } };

const tenantIdOf = caller => caller?.snapshotAttribute('tenantId');

describe('types namespace middleware', function() {
    before(runtime.beforeAll);

    let types, middleware, resumed;

    function resume(event) {
        resumed = event;

        return event;
    }

    function caller(tenantId) {
        return browser.materialize({ userId: 'user@test.com', tenantId });
    }

    beforeEach(function() {
        types = new Types();
        types.register(TYPE, model, 'TENANT');
        types.set('namespace', 'TEST', 'ECOSYSTEM');

        this.deps.define('types', types);

        middleware = typesMiddleware('TENANT', tenantIdOf);
        resumed = undefined;
    })

    describe('creation', function() {
        it('requires a namespace', function() {
            assert.throws(() => typesMiddleware(undefined, tenantIdOf), /namespace is required/);
        })

        it('requires a namespace id function', function() {
            assert.throws(() => typesMiddleware('TENANT'), /namespaceIdOf is required/);
        })
    })

    // NOTE: the bus gives each event its own container (a branch of the common deps); these tests do the same
    function event(tenantId, deps) {
        return { caller: caller(tenantId), deps: deps.branch(), context: {} };
    }

    describe('caller with a TENANT', function() {
        it('event types are namespaced by the caller TENANT', async function() {
            await middleware(event('TEST:TENANT', this.deps), resume);

            const types_ = resumed.deps.resolveSingle('types');

            assert.strictEqual(types_.get('namespace', 'TENANT'), 'TEST:TENANT');
            assert.strictEqual(types_.name(TYPE), `TEST:TENANT::${TYPE}`);
        })

        it('defines types on the event container', async function() {
            const e = event('TEST:TENANT', this.deps);

            await middleware(e, resume);

            assert.strictEqual(resumed, e);
            assert(e.deps.find('types', false), 'types should be defined on the event container');
        })

        it('keeps the root namespaces', async function() {
            await middleware(event('TEST:TENANT', this.deps), resume);

            assert.strictEqual(resumed.deps.resolveSingle('types').get('namespace', 'ECOSYSTEM'), 'TEST');
        })

        it('leaves the root types registry unchanged', async function() {
            await middleware(event('TEST:TENANT', this.deps), resume);

            assert.notStrictEqual(resumed.deps.resolveSingle('types'), types);
            assert.strictEqual(this.deps.resolveSingle('types'), types);
            assert.strictEqual(types.get('namespace', 'TENANT'), undefined);
        })

        it('events with different TENANTs get separate registries', async function() {
            await middleware(event('TEST:ONE', this.deps), resume);
            const one = resumed.deps.resolveSingle('types');

            await middleware(event('TEST:TWO', this.deps), resume);
            const two = resumed.deps.resolveSingle('types');

            assert.strictEqual(one.name(TYPE), `TEST:ONE::${TYPE}`);
            assert.strictEqual(two.name(TYPE), `TEST:TWO::${TYPE}`);
        })

        it('nested event with the same TENANT inherits the outer types', async function() {
            const outer = event('TEST:TENANT', this.deps);
            await middleware(outer, resume);

            const nested = event('TEST:TENANT', outer.deps);
            await middleware(nested, resume);

            assert.strictEqual(nested.deps.find('types', false), undefined);
            assert.strictEqual(nested.deps.resolveSingle('types'), outer.deps.resolveSingle('types'));
        })

        it('nested event with a different TENANT is re-namespaced', async function() {
            const outer = event('TEST:ONE', this.deps);
            await middleware(outer, resume);

            const nested = event('TEST:TWO', outer.deps);
            await middleware(nested, resume);

            assert.strictEqual(nested.deps.resolveSingle('types').name(TYPE), `TEST:TWO::${TYPE}`);
            assert.strictEqual(outer.deps.resolveSingle('types').name(TYPE), `TEST:ONE::${TYPE}`);
        })

        it('rejects a non-string namespace id', async function() {
            const m = typesMiddleware('TENANT', () => 123);

            await assert.rejects(m(event('TEST:TENANT', this.deps), resume), /must be a string/);
        })
    })

    describe('passes the event through unchanged', function() {
        it('without a caller', async function() {
            const e = { deps: this.deps.branch(), context: {} };

            await middleware(e, resume);

            assert.strictEqual(resumed, e);
            assert.strictEqual(e.deps.find('types', false), undefined);
        })

        it('with a caller without a TENANT', async function() {
            const e = event(undefined, this.deps);

            await middleware(e, resume);

            assert.strictEqual(resumed, e);
            assert.strictEqual(e.deps.find('types', false), undefined);
        })

        it('without a types registry', async function() {
            const deps = {
                resolveSingle: () => undefined,
                define: () => assert.fail('should not define types')
            };
            const e = { caller: caller('TEST:TENANT'), deps, context: {} };

            await middleware(e, resume);

            assert.strictEqual(resumed, e);
        })
    })

    describe('on the dispatch bus', function() {
        let $bus, seen;

        beforeEach(function() {
            seen = undefined;

            const events = {
                'unittest.namespaced': {
                    __metadata: { name: 'unittest.namespaced', triggers: { action: {} } },
                    action: async function({ deps }) {
                        seen = deps.resolveSingle('types').name(TYPE);

                        return seen;
                    }
                }
            };

            const [$resolver] = init(resolver.object(events));

            [$bus] = init(bus($resolver, [middleware], this.deps));
        })

        it('the trigger runs with the namespaced types', async function() {
            const result = await $bus.next({
                route: 'unittest.namespaced#action',
                caller: caller('TEST:TENANT'),
                deps: this.deps
            }).value;

            assert.strictEqual(result, `TEST:TENANT::${TYPE}`);
            assert.strictEqual(this.deps.resolveSingle('types').get('namespace', 'TENANT'), undefined);
        })

        it('a dispatch without a caller sees the root types', async function() {
            await assert.rejects(
                $bus.next({ route: 'unittest.namespaced#action', deps: this.deps }).value,
                /namespace \(name=TENANT\) is not defined/
            );
        })
    })
})
