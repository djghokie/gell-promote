const assert = require('assert');
const _ = require('lodash');

const runtime = require('gell-runtime/mocha');

const queries = require('../../../gell-discover/snapshot/queries');
const query = require('../../../gell-discover/snapshot/query');

/**
 * NOTE: these snapshots read a plain-object `queryRegistry` dependency (name => definition), not the
 * gell-discover/domain/queries Queries registry (see WIP in snapshot/queries.js)
 */
const QUERY_REGISTRY = {
    'unittest.one': {
        name: 'unittest.one',
        description: 'first query',
        parameters: { id: 'string' },
        filter: () => true,
        query: () => {}
    },
    'unittest.two': {
        name: 'unittest.two',
        description: 'second query',
        filter: () => true,
        query: () => {}
    },
};

describe('gell queries snapshot', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        this.deps.define('queryRegistry', {});
    })

    it('works', async function() {
        await queries.api({
            deps: this.deps
        });
    })

    it('returns nothing for an empty registry', async function() {
        const result = await queries.api({ deps: this.deps });

        assert.deepStrictEqual(result, []);
    })

    describe('populated registry', function() {
        beforeEach(function() {
            this.deps.define('queryRegistry', QUERY_REGISTRY);
        })

        it('returns name and description of each query', async function() {
            const result = await queries.api({ deps: this.deps });

            assert.deepStrictEqual(result, [
                { name: 'unittest.one', description: 'first query' },
                { name: 'unittest.two', description: 'second query' },
            ]);
        })
    })

    it('effect is not yet implemented', async function() {
        await assert.rejects(queries.effect({ deps: this.deps }), /NYI/);
    })
})

describe('gell query snapshot', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        this.deps.define('queryRegistry', QUERY_REGISTRY);
    })

    it('returns the named query definition', async function() {
        const result = await query.api({
            params: { name: 'unittest.one' },
            deps: this.deps
        });

        assert.strictEqual(result, QUERY_REGISTRY['unittest.one']);
    })

    it('returns undefined for an unknown name', async function() {
        const result = await query.api({
            params: { name: 'unittest.missing' },
            deps: this.deps
        });

        assert.strictEqual(result, undefined);
    })

    it('effect is not yet implemented', async function() {
        await assert.rejects(query.effect({ deps: this.deps }), /NYI/);
    })
})
