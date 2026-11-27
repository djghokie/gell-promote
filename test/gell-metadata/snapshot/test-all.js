const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const { Registry } = require('../../../gell-metadata/registry');

const all = require('../../../gell-metadata/snapshot/all');

describe('gell.registry.all', function() {
    before(runtime.beforeAll);

    let registry_;

    beforeEach(function() {
        registry_ = new Registry('query');
        registry_.register({ name: 'unittest.b', description: 'second', parameters: { type: 'string' } });
        registry_.register({ name: 'unittest.a', parameters: { limit: { type: 'number', optional: true } } });

        this.deps.define('store', {});
    })

    it('describes every entry of the context registry, sorted by name', async function() {
        const entries$ = await all.effect({ context: { registry_ }, deps: this.deps });

        assert.deepStrictEqual(entries$, [
            { name: 'unittest.a', description: undefined, parameters: [{ name: 'limit', type: 'number', optional: true }] },
            { name: 'unittest.b', description: 'second', parameters: [{ name: 'type', type: 'string', optional: false }] },
        ]);
    })

    it('describes an empty registry as an empty list', async function() {
        assert.deepStrictEqual(await all.effect({ context: { registry_: new Registry() }, deps: this.deps }), []);
    })
})
