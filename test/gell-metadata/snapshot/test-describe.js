const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const { Registry } = require('../../../gell-metadata/registry');

const describeSnapshot = require('../../../gell-metadata/snapshot/describe');

describe('gell.registry.describe', function() {
    before(runtime.beforeAll);

    let registry_;

    beforeEach(function() {
        registry_ = new Registry('query');
        registry_.register({
            name: 'unittest.one',
            description: 'the one',
            parameters: { type: 'string', limit: { type: 'number', optional: true } },
            filter: () => [],
        });
    })

    it('describes the named entry of the context registry', async function() {
        const entry$ = await describeSnapshot.effect({ params: { name: 'unittest.one' }, context: { registry_ }, deps: this.deps });

        assert.deepStrictEqual(entry$, {
            name: 'unittest.one',
            description: 'the one',
            parameters: [
                { name: 'type', type: 'string', optional: false },
                { name: 'limit', type: 'number', optional: true },
            ],
        });
    })

    it('returns undefined for a name the registry does not have', async function() {
        assert.strictEqual(await describeSnapshot.effect({ params: { name: 'unittest.missing' }, context: { registry_ }, deps: this.deps }), undefined);
    })

    it('requires a registry and a name', async function() {
        await assert.rejects(describeSnapshot.effect({ params: { name: 'unittest.one' }, deps: this.deps }), /registry_ is required/);
        await assert.rejects(describeSnapshot.effect({ params: {}, context: { registry_ }, deps: this.deps }), /name is required/);
    })
})
