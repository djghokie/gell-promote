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

    describe('caller with a TENANT', function() {
        it('event types are namespaced by the caller TENANT', async function() {
            await middleware({ caller: caller('TEST:TENANT'), deps: this.deps, context: {} }, resume);

            const types_ = resumed.deps.resolveSingle('types');

            assert.strictEqual(types_.get('namespace', 'TENANT'), 'TEST:TENANT');
            assert.strictEqual(types_.name(TYPE), `TEST:TENANT::${TYPE}`);
        })

        it('keeps the root namespaces', async function() {
            await middleware({ caller: caller('TEST:TENANT'), deps: this.deps, context: {} }, resume);

            assert.strictEqual(resumed.deps.resolveSingle('types').get('namespace', 'ECOSYSTEM'), 'TEST');
        })

        it('leaves the root types registry unchanged', async function() {
            await middleware({ caller: caller('TEST:TENANT'), deps: this.deps, context: {} }, resume);

            assert.notStrictEqual(resumed.deps.resolveSingle('types'), types);
            assert.strictEqual(this.deps.resolveSingle('types').get('namespace', 'TENANT'), undefined);
        })

        it('keeps the rest of the event', async function() {
            const context = {};
            const __invocationSpec = { route: 'unittest.event#action' };
            const params = { a: 1 };

            await middleware({ caller: caller('TEST:TENANT'), deps: this.deps, context, params, __invocationSpec }, resume);

            assert.strictEqual(resumed.context, context);
            assert.strictEqual(resumed.params, params);
            assert.strictEqual(resumed.__invocationSpec, __invocationSpec);
        })

        it('callers with different TENANTs get separate registries', async function() {
            await middleware({ caller: caller('TEST:ONE'), deps: this.deps, context: {} }, resume);
            const one = resumed.deps.resolveSingle('types');

            await middleware({ caller: caller('TEST:TWO'), deps: this.deps, context: {} }, resume);
            const two = resumed.deps.resolveSingle('types');

            assert.strictEqual(one.name(TYPE), `TEST:ONE::${TYPE}`);
            assert.strictEqual(two.name(TYPE), `TEST:TWO::${TYPE}`);
        })

        it('reuses deps already namespaced by the same TENANT (nested dispatch)', async function() {
            await middleware({ caller: caller('TEST:TENANT'), deps: this.deps, context: {} }, resume);
            const outer = resumed;

            await middleware({ caller: caller('TEST:TENANT'), deps: outer.deps, context: {} }, resume);

            assert.strictEqual(resumed.deps, outer.deps);
        })

        it('re-namespaces deps namespaced by a different TENANT', async function() {
            await middleware({ caller: caller('TEST:ONE'), deps: this.deps, context: {} }, resume);
            const outer = resumed;

            await middleware({ caller: caller('TEST:TWO'), deps: outer.deps, context: {} }, resume);

            assert.strictEqual(resumed.deps.resolveSingle('types').name(TYPE), `TEST:TWO::${TYPE}`);
            assert.strictEqual(outer.deps.resolveSingle('types').name(TYPE), `TEST:ONE::${TYPE}`);
        })

        it('rejects a non-string namespace id', async function() {
            const m = typesMiddleware('TENANT', () => 123);

            await assert.rejects(m({ caller: caller('TEST:TENANT'), deps: this.deps, context: {} }, resume), /must be a string/);
        })
    })

    describe('passes the event through unchanged', function() {
        it('without a caller', async function() {
            const event = { deps: this.deps, context: {} };

            await middleware(event, resume);

            assert.strictEqual(resumed, event);
        })

        it('with a caller without a TENANT', async function() {
            const event = { caller: caller(undefined), deps: this.deps, context: {} };

            await middleware(event, resume);

            assert.strictEqual(resumed, event);
        })

        it('without a types registry', async function() {
            const deps = {
                resolveSingle: () => undefined,
                branch: () => assert.fail('should not branch')
            };
            const event = { caller: caller('TEST:TENANT'), deps, context: {} };

            await middleware(event, resume);

            assert.strictEqual(resumed, event);
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
