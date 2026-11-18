const assert = require('assert');

const MockStore = require('gell-aws-dynamodb/mock/store');

const runtime = require('../../gell-runtime/mocha');

const tenant = require('../../gell-namespace/domain/tenant');
const application = require('../../gell-namespace/domain/application');

const ACTION = {
    __metadata: {
        name: 'unittest.thing.create',
        triggers: {
            action: {
                params: { name: 'string' },
                transaction: 'NEW'
            }
        }
    },
    action: async function({ params, context, deps }) {
        deps.define('invocationScoped', 'defined');

        return { name: params.name, hasTxn: !!context.$txn };
    }
}

const SNAPSHOT = {
    __metadata: {
        name: 'unittest.things',
        triggers: {
            api: { params: {} }
        }
    },
    api: async function({ caller }) {
        return { caller };
    }
}

describe('gell-runtime/mocha', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        this.deps.define('store', new MockStore());

        this.registerAction(ACTION);
        this.registerSnapshot(SNAPSHOT);
    })

    it('registers action modules as events and api modules as snapshots', function() {
        assert.strictEqual(this.events['unittest.thing.create'], ACTION);
        assert.strictEqual(this.snapshots['unittest.things'], SNAPSHOT);
        assert.strictEqual(this.events['unittest.things'], undefined);
    })

    describe('registerType', function() {
        it('registers the TYPE on the types dependency', function() {
            this.registerType(tenant);

            const types = this.deps.resolveSingle('types');

            assert.strictEqual(types, this.types);
            assert.strictEqual(types.get(tenant.TYPE), tenant.model);
        })

        it('scopes the TYPE to a namespace', function() {
            this.registerType(application, 'ECOSYSTEM');
            this.types.set('namespace', 'UNITTEST', 'ECOSYSTEM');

            assert.strictEqual(this.types.name(application.TYPE), `UNITTEST::${application.TYPE}`);
        })

        it('requires a TYPE', function() {
            assert.throws(() => this.registerType({ model: {} }));
        })
    })

    describe('discover', function() {
        beforeEach(function() {
            this.discover(`${__dirname}/../../gell-namespace`);
        })

        it('registers discovered action modules as events', function() {
            assert(this.events['namespace.application.create'], 'missing namespace.application.create');
        })

        it('registers discovered api modules as snapshots', function() {
            assert(this.snapshots['namespace.applications.active'], 'missing namespace.applications.active');
            assert.strictEqual(this.events['namespace.applications.active'], undefined);
        })
    })

    it('dispatches actions on $actions with a transaction', async function() {
        const thing = await this.action({ route: 'unittest.thing.create#action', params: { name: 'one' } });

        assert.deepStrictEqual(thing, { name: 'one', hasTxn: true });
    })

    it('dispatches snapshots on $snapshots', async function() {
        const result = await this.snapshot({ route: 'unittest.things#api', caller: 'CALLER' });

        assert.strictEqual(result.caller, 'CALLER');
    })

    it('does not dispatch snapshots on $actions', async function() {
        await assert.rejects(this.action({ route: 'unittest.things#api' }), /no event/);
    })

    it('does not dispatch actions on $snapshots', async function() {
        await assert.rejects(this.snapshot({ route: 'unittest.thing.create#action', params: { name: 'one' } }), /no event/);
    })

    it('rejects missing required params', async function() {
        await assert.rejects(this.action({ route: 'unittest.thing.create#action', params: {} }), /RequiredParameterError/);
    })

    /**
     * WIP: gell-dispatch arguments middleware only type checks object param specs ({ type: 'string' }); shorthand
     * specs (name: 'string') are not checked, in the app or here
     */
    it('rejects params of the wrong type', async function() {
        this.events['unittest.thing.rename'] = {
            ...ACTION,
            __metadata: {
                name: 'unittest.thing.rename',
                triggers: {
                    action: { params: { name: { type: 'string' } } }
                }
            }
        };

        await assert.rejects(this.action({ route: 'unittest.thing.rename#action', params: { name: 42 } }), /ParameterValidationError/);
    })

    it('gives each invocation its own dependency container', async function() {
        await this.action({ route: 'unittest.thing.create#action', params: { name: 'one' } });

        assert.strictEqual(this.deps.resolveSingle({ name: 'invocationScoped', optional: true }), undefined);
    })
})
