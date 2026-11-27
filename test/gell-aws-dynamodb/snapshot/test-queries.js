const assert = require('assert');

const runtime = require('gell-runtime/mocha');

const Store = require('../../../gell-aws-dynamodb/mock/store');

const queriesSnapshot = require('../../../gell-aws-dynamodb/snapshot/queries');
const querySnapshot = require('../../../gell-aws-dynamodb/snapshot/query');

const QUERIES = {
    byType: {
        name: 'unittest.type',
        description: 'items by type',
        parameters: { type: 'string' },
        filter: (items, { type }) => items.filter(i$ => i$.type === type),
        query: () => {},
    },
    byRank: {
        name: 'unittest.rank',
        description: 'items by type, optionally with a minimum rank',
        parameters: { type: 'string', rank: { type: 'number', optional: true } },
        filter: (items, { type, rank }) => items.filter(i$ => i$.type === type && (rank === undefined || i$.rank >= rank)),
        query: () => {},
    },
}


describe('gell-aws-dynamodb named query snapshots', function() {
    before(runtime.beforeAll);

    beforeEach(async function() {
        const store = new Store('type', 'id');
        store.queries.registerModule(QUERIES);

        for (const rank of [1, 2, 3]) await store.save({ type: 'UNITTEST#ITEM', id: `item-${rank}`, rank });

        this.deps.define('store', store);
    })

    describe('store.named.queries', function() {
        it('returns metadata of every registered query, sorted by name', async function() {
            const queries$ = await queriesSnapshot.api({ params: {}, deps: this.deps });

            assert.deepStrictEqual(queries$, [
                {
                    name: 'unittest.rank',
                    description: 'items by type, optionally with a minimum rank',
                    parameters: [
                        { name: 'type', type: 'string', optional: false },
                        { name: 'rank', type: 'number', optional: true },
                    ],
                },
                {
                    name: 'unittest.type',
                    description: 'items by type',
                    parameters: [
                        { name: 'type', type: 'string', optional: false },
                    ],
                },
            ]);
        })
    })

    describe('store.named.query', function() {
        it('returns query metadata by name', async function() {
            const query$ = await querySnapshot.api({ params: { name: 'unittest.type' }, deps: this.deps });

            assert.deepStrictEqual(query$, {
                name: 'unittest.type',
                description: 'items by type',
                parameters: [{ name: 'type', type: 'string', optional: false }],
            });
        })

        it('reports an unknown query as 404', async function() {
            await assert.rejects(querySnapshot.api({ params: { name: 'unittest.missing' }, deps: this.deps }), { status: 404, message: 'query not found (name=unittest.missing)' });
        })
    })
})
