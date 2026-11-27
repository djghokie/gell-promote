const assert = require('assert');

const runtime = require('gell-runtime/mocha');


const Store = require('../../../../../gell-aws-dynamodb/mock/store');
const { Queries } = require('../../../../../gell-discover/domain/queries');

const queriesSnapshot = require('../../../../../gell-metadata/store/query/snapshot/queries');
const querySnapshot = require('../../../../../gell-metadata/store/query/snapshot/query');
const queryRunSnapshot = require('../../../../../gell-metadata/store/query/snapshot/run');

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

const ADMINISTRATOR = { snapshotAttribute: name => name === 'role' ? 'administrator' : undefined };
const USER = { snapshotAttribute: name => name === 'role' ? 'user' : undefined };

describe('gell-metadata store queries', function() {
    before(runtime.beforeAll);

    beforeEach(async function() {
        const queries_ = new Queries();
        queries_.registerModule(QUERIES);

        const store = new Store('type', 'id');
        store.configureQueries(queries_.definitions());

        for (const rank of [1, 2, 3]) await store.save({ type: 'UNITTEST#ITEM', id: `item-${rank}`, rank });

        this.deps.define('queries', queries_);
        this.deps.define('store', store);
    })

    describe('gell.domain.queries', function() {
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

        it('effect returns the same metadata', async function() {
            const queries$ = await queriesSnapshot.effect({ params: {}, deps: this.deps });

            assert.deepStrictEqual(queries$.map(q$ => q$.name), ['unittest.rank', 'unittest.type']);
        })
    })

    describe('gell.domain.query', function() {
        it('returns query metadata by name', async function() {
            const query$ = await querySnapshot.api({ params: { name: 'unittest.type' }, deps: this.deps });

            assert.strictEqual(query$.name, 'unittest.type');
            assert.strictEqual(query$.description, 'items by type');
        })

        it('effect returns undefined for an unknown query', async function() {
            assert.strictEqual(await querySnapshot.effect({ params: { name: 'unittest.missing' }, deps: this.deps }), undefined);
        })

        it('api reports an unknown query as 404', async function() {
            await assert.rejects(querySnapshot.api({ params: { name: 'unittest.missing' }, deps: this.deps }), { status: 404 });
        })
    })

    describe('gell.domain.query.run', function() {
        async function runQuery(params, caller=ADMINISTRATOR) {
            return queryRunSnapshot.api({ caller, params, deps: this.deps });
        }

        it('returns items matching the query args', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.type', args: { type: 'UNITTEST#ITEM' } });

            assert.strictEqual(run$.name, 'unittest.type');
            assert.deepStrictEqual(run$.args, { type: 'UNITTEST#ITEM' });
            assert.deepStrictEqual(run$.items.map(i$ => i$.id).sort(), ['item-1', 'item-2', 'item-3']);
            assert.strictEqual(run$.truncated, false);
        })

        it('caps items at limit and reports truncated', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.type', args: { type: 'UNITTEST#ITEM' }, limit: 2 });

            assert.strictEqual(run$.items.length, 2);
            assert.strictEqual(run$.limit, 2);
            assert.strictEqual(run$.truncated, true);
        })

        it('is not truncated when items equal limit', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.type', args: { type: 'UNITTEST#ITEM' }, limit: 3 });

            assert.strictEqual(run$.items.length, 3);
            assert.strictEqual(run$.truncated, false);
        })

        it('accepts args as a JSON string', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.type', args: JSON.stringify({ type: 'UNITTEST#ITEM' }) });

            assert.strictEqual(run$.items.length, 3);
        })

        it('reports args that are not JSON as 400', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.type', args: '{' }), { status: 400 });
        })

        it('coerces number args', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.rank', args: { type: 'UNITTEST#ITEM', rank: '2' } });

            assert.deepStrictEqual(run$.args, { type: 'UNITTEST#ITEM', rank: 2 });
            assert.deepStrictEqual(run$.items.map(i$ => i$.id).sort(), ['item-2', 'item-3']);
        })

        it('reports a number arg that is not a number as 400', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.rank', args: { type: 'UNITTEST#ITEM', rank: 'x' } }), { status: 400 });
        })

        it('omits blank optional args', async function() {
            const run$ = await runQuery.call(this, { name: 'unittest.rank', args: { type: 'UNITTEST#ITEM', rank: '' } });

            assert.deepStrictEqual(run$.args, { type: 'UNITTEST#ITEM' });
        })

        it('reports a missing required arg as 400', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.type', args: { type: '' } }), { status: 400 });
        })

        it('reports an unknown query as 404', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.missing' }), { status: 404 });
        })

        it('rejects a caller that is not an administrator as 403', async function() {
            await assert.rejects(runQuery.call(this, { name: 'unittest.type', args: { type: 'UNITTEST#ITEM' } }, USER), { status: 403 });
        })
    })
})
