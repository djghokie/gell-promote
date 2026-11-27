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

        describe('a named query definition', function() {
            const PARENT_ID = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

            let received;

            beforeEach(function() {
                received = undefined;

                store.queries.register({
                    name: 'unittest.by.parent',
                    parameters: {
                        type: { type: 'string', validate: { minLength: 4 } },
                        limit: { type: 'number', optional: true, validate: { min: 1 } },
                        parentId: { type: 'uuid', optional: true },
                    },
                    query: args => {
                        received = args;

                        return { table: 'table.unittest', hash: args.type, options: {} };
                    },
                });
            })

            it('gets the coerced args', async function() {
                await store.drain('unittest.by.parent', { type: 'GELL#SESSION', limit: '2', parentId: PARENT_ID });

                assert.deepStrictEqual(received, { type: 'GELL#SESSION', limit: 2, parentId: PARENT_ID });
            })

            it('does not get an omitted optional parameter', async function() {
                await store.drain('unittest.by.parent', { type: 'GELL#SESSION' });

                assert.deepStrictEqual(received, { type: 'GELL#SESSION' });
            })

            it('is not run when its args fail validation, and every failing parameter is reported', function() {
                assert.throws(() => store.query('unittest.by.parent', { limit: -5, parentId: 'note-1' }), e => {
                    assert.strictEqual(e.name, 'ObjectValidationError');
                    assert.deepStrictEqual(e.errors.map(({ property, rule }) => ({ property, rule })), [
                        { property: 'type', rule: 'required' },
                        { property: 'limit', rule: 'min' },
                        { property: 'parentId', rule: 'isUuid' },
                    ]);

                    return true;
                });
                assert.strictEqual(received, undefined);
            })
        })

        it('reports a required parameter of a named query called without args', function() {
            assert.throws(() => store.query(QUERY.name), isInvalid('type', 'required'));
            assert.throws(() => store.page(QUERY.name), isInvalid('type', 'required'));
        })

        it('runs a static query of a named query definition', async function() {
            store.queries.register({ name: 'unittest.fixed', query: { table: 'table.unittest', hash: 'FIXED', options: {} } });

            await store.drain('unittest.fixed');
            assert.strictEqual(table.lastQuery.hash, 'FIXED');
        })

        it('passes args through to the query of a definition without parameters', async function() {
            store.queries.register({ name: 'unittest.open', query: ({ hash }) => ({ table: 'table.unittest', hash, options: {} }) });

            await store.drain('unittest.open', { hash: 'OPEN' });
            assert.strictEqual(table.lastQuery.hash, 'OPEN');
        })

        it('throws for a named query that does not define a DynamoDB implementation', function() {
            store.queries.register({ name: 'unittest.filterOnly', filter: items => items });

            assert.throws(() => store.query('unittest.filterOnly', {}), /named query \(name=unittest.filterOnly\) does not define a DynamoDB implementation/);
            assert.throws(() => store.page('unittest.filterOnly', {}), /named query \(name=unittest.filterOnly\) does not define a DynamoDB implementation/);
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

        // NOTE: as for a param, a blank (null or '') required argument counts as missing
        it('fails to commit a named operation with a blank required parameter', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'T', id: '1' }, ts: '' });

            await assert.rejects(async () => $txn.return().value, isInvalid('ts', 'required'));
            assert.strictEqual(sent.length, 0);
        })

        it('commits a copy of a static operation command', async function() {
            const command = { Update: { UpdateExpression: 'SET done=:done', ExpressionAttributeValues: { ':done': true } } };
            store.operations.register({ name: 'unittest.done', operation: command });

            for (const id of ['1', '2']) {
                const $txn = store.write();
                $txn.next({ name: 'unittest.done', key: { type: 'T', id } });
                await $txn.return().value;
            }

            assert.deepStrictEqual(sent.map(({ input }) => input.TransactItems[0].Update.Key), [{ type: 'T', id: '1' }, { type: 'T', id: '2' }]);
            assert.strictEqual(sent[0].input.TransactItems[0].Update.UpdateExpression, 'SET done=:done');
            assert.deepStrictEqual(command, { Update: { UpdateExpression: 'SET done=:done', ExpressionAttributeValues: { ':done': true } } });
        })

        it('fails to commit a named operation that does not define its command', async function() {
            store.operations.register({ name: 'unittest.modifyOnly', modify: item$ => item$ });

            const $txn = store.write();
            $txn.next({ name: 'unittest.modifyOnly', key: { type: 'T', id: '1' } });

            await assert.rejects(async () => $txn.return().value, /named operation \(name=unittest.modifyOnly\) does not define a DynamoDB implementation/);
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

        it('reports a required parameter of a named query called without args', function() {
            assert.throws(() => store.query(QUERY.name), isInvalid('type', 'required'));
        })

        it('passes args through to the filter of a definition without parameters', async function() {
            store.queries.register({ name: 'unittest.byId', filter: (items, { id }) => items.filter(item$ => item$.id === id) });

            assert.deepStrictEqual((await store.drain('unittest.byId', { id: '2' })).map(item$ => item$.id), ['2']);
        })

        it('throws for a named query that does not define a filter', function() {
            store.queries.register({ name: 'unittest.queryOnly', query: {} });

            assert.throws(() => store.query('unittest.queryOnly', {}), /named query \(name=unittest.queryOnly\) does not define a filter/);
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

        // NOTE: as for a param, a blank (null or '') required argument counts as missing
        it('fails to commit a named operation with a blank required parameter', async function() {
            const $txn = store.write();
            $txn.next({ name: OPERATION.name, key: { type: 'GELLO', id: '1' }, ts: null });

            await assert.rejects(async () => $txn.return().value, isInvalid('ts', 'required'));
        })

        it('fails to commit a named operation that does not define modify', async function() {
            store.operations.register({ name: 'unittest.operationOnly', operation: {} });

            const $txn = store.write();
            $txn.next({ name: 'unittest.operationOnly', key: { type: 'GELLO', id: '1' } });

            await assert.rejects(async () => $txn.return().value, /named operation \(name=unittest.operationOnly\) does not define modify/);
        })
    })
})
