const assert = require('assert');

const { MockTable } = require('gell-aws-dynamodb/ut/toolbox');

const Store = require('../../gell-aws-dynamodb/store');
const MockStore = require('../../gell-aws-dynamodb/mock/store');

const QUERY = {
    name: 'unittest.by.type',
    parameters: {
        type: { type: 'string', validate: { minLength: 4 } },
        limit: { type: 'number', optional: true, validate: { min: 1 } },
    },
    query: ({ type }) => ({ table: 'table.unittest', hash: type, options: {} }),
    filter: (items, { type, limit=items.length }) => items.filter(item$ => item$.type === type).slice(0, limit),
};

const OPERATION = {
    name: 'unittest.touch',
    parameters: {
        ts: { type: 'timestamp' },
    },
    operation: ({ key, ts }) => ({ Update: { Key: key, UpdateExpression: 'SET ts=:ts', ExpressionAttributeValues: { ':ts': ts } } }),
    modify: (item$, { ts }) => {
        item$.ts = ts;

        return item$;
    },
};

function isInvalid(property, rule) {
    return e => e.name === 'ObjectValidationError' && e.errors.some(error => error.property === property && error.rule === rule);
}

describe('gell-aws-dynamodb stores', function() {
    describe('store (DynamoDB, single table)', function() {
        let store, table, sent;

        beforeEach(function() {
            table = new MockTable();
            sent = [];

            const singletons = {
                'table.unittest': table,
                dynamodb: { send: async command => sent.push(command) },
                logger: { info() {}, warn() {}, error() {}, debug() {} },
            };
            const deps = {
                resolveSingle: name => singletons[typeof name === 'string' ? name : name.name],
                resolve: (...names) => Object.fromEntries(names.map(name => [name, singletons[name]])),
            };

            store = new Store({ name: 'unittest', partitionKey: 'type', sortKey: 'id', indexes: {} }, deps);
            store.queries.register(QUERY);
            store.operations.register(OPERATION);
        })

        it('keeps the definitions in its registries, not in maps', function() {
            assert.strictEqual(store.queries.get(QUERY.name), QUERY);
            assert.strictEqual(store.operations.get(OPERATION.name), OPERATION);
            assert.strictEqual(store.namedQueries, undefined);
            assert.strictEqual(store.namedOperations, undefined);
        })

        it('runs a named query with coerced args', async function() {
            assert.deepStrictEqual(await store.drain(QUERY.name, { type: 'GELL#SESSION', limit: '2' }), []);
            assert.strictEqual(table.lastQuery.hash, 'GELL#SESSION');
        })

        it('throws for a named query argument that fails validation, and runs the next query', async function() {
            assert.throws(() => store.query(QUERY.name, { type: 'X' }), isInvalid('type', 'minLength'));

            await store.drain(QUERY.name, { type: 'FOOBAR' });
            assert.strictEqual(table.lastQuery.hash, 'FOOBAR');
        })

        it('pages a named query definition', function() {
            assert(typeof store.page(QUERY.name, { type: 'GELL#SESSION' }).next === 'function');
            assert.throws(() => store.page(QUERY.name, {}), isInvalid('type', 'required'));
        })

        it('commits a named operation with its coerced request', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'T', id: '1' }, ts: '1000' });
            await $txn.return().value;

            const [{ Update }] = sent[0].input.TransactItems;

            assert.strictEqual(Update.TableName, 'unittest');
            assert.deepStrictEqual(Update.Key, { type: 'T', id: '1' });
            assert.deepStrictEqual(Update.ExpressionAttributeValues, { ':ts': 1000 });
        })

        it('fails to commit a named operation whose request fails validation', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'T', id: '1' }, ts: 'someday' });

            await assert.rejects(async () => $txn.return().value, isInvalid('ts', 'isTimestamp'));
            assert.strictEqual(sent.length, 0);
        })

        it('fails an assert for a definition with a parameter type that is not defined', function() {
            const bad = { name: 'unittest.bad', parameters: { to: 'email' }, query: {} };

            assert.throws(() => store.queries.register(bad), /query parameter type is not defined \(query=unittest.bad; parameter=to; type=email\)/);
            assert.throws(() => store.operations.register(bad), /operation parameter type is not defined \(operation=unittest.bad/);
        })

        it('fails an assert for a named query or operation that is not registered', async function() {
            assert.throws(() => store.page('unittest.none'), /no named query \(name=unittest.none\) defined/);

            const $txn = store.write();
            assert.throws(() => $txn.next({ name: 'unittest.none', key: { type: 'X', id: '1' } }), /no named operation \(name=unittest.none\)/);
        })
    })

    describe('mock store (in memory)', function() {
        let store;

        beforeEach(async function() {
            store = new MockStore('type', 'id');
            store.queries.register(QUERY);
            store.operations.register(OPERATION);

            await store.save({ type: 'GELLO', id: '1' });
            await store.save({ type: 'GELLO', id: '2' });
            await store.save({ type: 'FOOBAR', id: '3' });
        })

        it('keeps the definitions in its registries, not in maps', function() {
            assert.strictEqual(store.queries.get(QUERY.name), QUERY);
            assert.strictEqual(store.operations.get(OPERATION.name), OPERATION);
            assert.strictEqual(store.namedQueries, undefined);
            assert.strictEqual(store.writeOptions, undefined);
        })

        it('runs a named query filter with coerced args', async function() {
            assert.deepStrictEqual((await store.drain(QUERY.name, { type: 'GELLO', limit: '1' })).map(item$ => item$.id), ['1']);
        })

        it('throws for a named query argument that fails validation, and runs the next query', async function() {
            assert.throws(() => store.query(QUERY.name, { type: 'X' }), isInvalid('type', 'minLength'));

            assert.deepStrictEqual((await store.drain(QUERY.name, { type: 'FOOBAR' })).map(item$ => item$.id), ['3']);
        })

        it('runs a named operation modify with its coerced request', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'GELLO', id: '1' }, ts: '1000' });
            await $txn.return().value;

            assert.strictEqual(store.select({ id: '1' })[0].ts, 1000);
        })

        it('fails to commit a named operation whose request fails validation', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'GELLO', id: '1' }, ts: 'someday' });

            await assert.rejects(async () => $txn.return().value, isInvalid('ts', 'isTimestamp'));
            assert.strictEqual(store.select({ id: '1' })[0].ts, undefined);
        })

    })
})
