const assert = require('assert');

const { init } = require('gell/future');
const MockStore = require('gell-aws-dynamodb/mock/store');

const DependencyContainer = require('gell-dependency/container');
const { Stereotypes } = require('../../../gell-stereotype/domain/stereotypes');
const resolver = require('../../../gell-stereotype/dispatch/resolver');

const runtime = require('../../../gell-runtime/mocha');
const stereotypeFixtures = require('../../../gell-stereotype/ut/mocha');

const CREATE = {
    __metadata: {
        name: 'thing.create',
        triggers: {
            action: {
                params: { name: 'string' },
                transaction: 'NEW'
            }
        }
    },
    action: async function({ params, context }) {
        return {
            name: params.name,
            extension: context.extension.name,
            stereotype: context.stereotype.name,
            hasTxn: !!context.$txn,
        };
    }
}

const LIST = {
    __metadata: {
        name: 'things.all',
        triggers: {
            api: { params: {} }
        }
    },
    api: async function({ context }) {
        return { type: context.extension.TYPE };
    }
}

const THING = {
    name: 'thing',
    actions: [CREATE],
    snapshots: [LIST],
}

const WIDGET = {
    name: 'WIDGET',
    TYPE: 'UNITTEST#WIDGET',
    extends: THING,
}

describe('gell-stereotype/dispatch/resolver', function() {
    before(runtime.beforeAll);
    beforeEach(stereotypeFixtures.beforeEach);

    beforeEach(function() {
        this.deps.define('store', new MockStore());

        this.stereotypes.register(THING);
        this.stereotypes.register(WIDGET);
    })

    it('invokes the inherited action with the extension in context', async function() {
        const result = await this.action({ route: 'WIDGET$thing.create#action', params: { name: 'one' } });

        assert.deepStrictEqual(result, { name: 'one', extension: 'WIDGET', stereotype: 'thing', hasTxn: true });
    })

    it('invokes the inherited snapshot with the extension in context', async function() {
        const result = await this.snapshot({ route: 'WIDGET$things.all#api' });

        assert.deepStrictEqual(result, { type: 'UNITTEST#WIDGET' });
    })

    it('validates params with the inherited trigger spec', async function() {
        await assert.rejects(this.action({ route: 'WIDGET$thing.create#action', params: {} }), /RequiredParameterError/);
    })

    // NOTE: the bus's transaction middleware still adds $txn to the caller's context (as for regular events)
    it('does not add the extension to the caller context', async function() {
        const context = {};

        await this.action({ route: 'WIDGET$thing.create#action', params: { name: 'one' }, context });

        assert.strictEqual(context.extension, undefined);
        assert.strictEqual(context.stereotype, undefined);
    })

    it('resolves stereotypes extended by name', async function() {
        this.stereotypes.register({ name: 'GADGET', extends: 'thing' });

        const result = await this.action({ route: 'GADGET$thing.create#action', params: { name: 'one' } });

        assert.strictEqual(result.extension, 'GADGET');
    })

    it('resolves events inherited through an extension', async function() {
        this.stereotypes.register({ name: 'SPECIAL', extends: WIDGET });

        const result = await this.action({ route: 'SPECIAL$thing.create#action', params: { name: 'one' } });

        assert.strictEqual(result.extension, 'SPECIAL');
        assert.strictEqual(result.stereotype, 'thing');
    })

    it('prefers an event declared by the extension', async function() {
        const override = {
            ...CREATE,
            action: async ({ context }) => ({ overridden: true, stereotype: context.stereotype.name })
        };

        this.stereotypes.register({ name: 'CUSTOM', extends: THING, actions: [override] });

        const result = await this.action({ route: 'CUSTOM$thing.create#action', params: { name: 'one' } });

        assert.deepStrictEqual(result, { overridden: true, stereotype: 'CUSTOM' });
    })

    it('fails for an unknown extension', async function() {
        await assert.rejects(this.action({ route: 'UNKNOWN$thing.create#action', params: { name: 'one' } }), /no event/);
    })

    it('fails for an event the extension does not inherit', async function() {
        await assert.rejects(this.action({ route: 'WIDGET$thing.delete#action' }), /no event/);
    })

    it('does not resolve snapshots on $actions', async function() {
        await assert.rejects(this.action({ route: 'WIDGET$things.all#api' }), /no event/);
    })

    it('routes regular events to the runtime catalogs', async function() {
        this.registerAction({ ...CREATE, __metadata: { ...CREATE.__metadata, name: 'regular.create' }, action: async () => 'regular' });

        assert.strictEqual(await this.action({ route: 'regular.create#action', params: { name: 'one' } }), 'regular');
    })
})

describe('gell-stereotype/dispatch/resolver.object', function() {
    beforeEach(function() {
        const stereotypes = new Stereotypes();
        stereotypes.register(THING);
        stereotypes.register(WIDGET);

        this.deps = new DependencyContainer({ stereotypes });
    })

    it('resolves regular routes in the resource map', function() {
        const [$resolver] = init(resolver.object({ 'thing.create': CREATE }, { deps: this.deps }));

        const [resource, components, names] = $resolver.next('thing.create#action').value;

        assert.strictEqual(resource, CREATE);
        assert.strictEqual(components.f, CREATE.action);
        assert.deepStrictEqual(names, { resource: 'thing.create', f: 'action' });
    })

    it('resolves stereotyped routes to the inherited event', function() {
        const [$resolver] = init(resolver.object({}, { deps: this.deps }));

        const [resource, components, names] = $resolver.next('WIDGET$thing.create#action').value;

        assert.strictEqual(resource.__metadata.name, 'WIDGET$thing.create');
        assert.strictEqual(resource.__metadata.inherits, 'thing.create');
        assert.strictEqual(resource.__metadata.extension, 'WIDGET');
        assert.strictEqual(resource.__metadata.stereotype, 'thing');
        assert.strictEqual(resource.action, components.f);
        assert.deepStrictEqual(names, { resource: 'WIDGET$thing.create', f: 'action' });
    })

    it('does not resolve stereotyped routes without deps', function() {
        const [$resolver] = init(resolver.object({}));

        const [resource] = $resolver.next('WIDGET$thing.create#action').value;

        assert.strictEqual(resource, undefined);
    })

    it('does not resolve unknown regular routes', function() {
        const [$resolver] = init(resolver.object({}, { deps: this.deps }));

        const [resource, components] = $resolver.next('thing.create#action').value;

        assert.strictEqual(resource, undefined);
        assert.deepStrictEqual(components, { resource: undefined });
    })
})
