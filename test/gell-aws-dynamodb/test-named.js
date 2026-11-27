const assert = require('assert');

const named = require('../../gell-aws-dynamodb/named');

const PARENT_ID = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

/**
 * Matches the ObjectValidationError a named query or operation throws
 */
function invalid(errors) {
    return e => {
        assert.strictEqual(e.name, 'ObjectValidationError');
        assert.deepStrictEqual(e.errors.map(({ property, rule }) => ({ property, rule })), errors);

        return true;
    }
}

describe('gell-aws-dynamodb/named', function() {
    let received;

    beforeEach(function() {
        received = undefined;
    })

    describe('query and filter', function() {
        const def = {
            name: 'unittest.by.type',
            parameters: {
                type: { type: 'string', validate: { minLength: 4 } },
                limit: { type: 'number', optional: true, validate: { min: 1 } },
                parentId: { type: 'uuid', optional: true },
            },
            filter: (items, args) => {
                received = args;

                return items.filter(item$ => item$.type === args.type);
            },
            query: args => {
                received = args;

                return { table: 'session', hash: args.type };
            },
        };

        const items = [{ type: 'GELLO' }, { type: 'FOOBAR' }];

        it('query passes the coerced args to the definition and returns its query', function() {
            assert.deepStrictEqual(named.query('unittest.by.type', def, { type: 'GELL#SESSION', limit: '2', parentId: PARENT_ID }), { table: 'session', hash: 'GELL#SESSION' });
            assert.deepStrictEqual(received, { type: 'GELL#SESSION', limit: 2, parentId: PARENT_ID });
        })

        it('filter passes the coerced args to the definition and returns its items', function() {
            assert.deepStrictEqual(named.filter('unittest.by.type', def, items, { type: 'FOOBAR', limit: '10' }), [{ type: 'FOOBAR' }]);
            assert.deepStrictEqual(received, { type: 'FOOBAR', limit: 10 });
        })

        it('does not add an omitted optional parameter', function() {
            named.query('unittest.by.type', def, { type: 'GELL#SESSION' });

            assert.deepStrictEqual(received, { type: 'GELL#SESSION' });
        })

        it('reports every failing parameter, without running the definition', function() {
            assert.throws(() => named.query('unittest.by.type', def, { limit: -5, parentId: 'note-1' }), invalid([
                { property: 'type', rule: 'required' },
                { property: 'limit', rule: 'min' },
                { property: 'parentId', rule: 'isUuid' },
            ]));
            assert.throws(() => named.filter('unittest.by.type', def, items, { type: 'FOO' }), invalid([{ property: 'type', rule: 'minLength' }]));
            assert.strictEqual(received, undefined);
        })

        it('reports a required parameter of a call without args', function() {
            assert.throws(() => named.query('unittest.by.type', def), invalid([{ property: 'type', rule: 'required' }]));
            assert.throws(() => named.filter('unittest.by.type', def, items), invalid([{ property: 'type', rule: 'required' }]));
        })

        it('returns a query that is not a function', function() {
            assert.deepStrictEqual(named.query('fixed', { name: 'fixed', query: { table: 'session' } }, {}), { table: 'session' });
        })

        it('passes args through for a definition without parameters', function() {
            assert.deepStrictEqual(named.filter('open', { name: 'open', filter: (items, args) => args }, [], { a: 1 }), { a: 1 });
        })

        it('calls a definition that is a function as it is', function() {
            assert.deepStrictEqual(named.query('fn', args => ({ table: 'session', hash: args.type }), { type: 'X' }), { table: 'session', hash: 'X' });
            assert.deepStrictEqual(named.filter('fn', (items, args) => items.filter(item$ => item$.type === args.type), items, { type: 'GELLO' }), [{ type: 'GELLO' }]);
        })

        it('fails an assert for a definition without the implementation', function() {
            assert.throws(() => named.query('filterOnly', { name: 'filterOnly', filter: items => items }, {}), /named query \(name=filterOnly\) does not define a DynamoDB implementation/);
            assert.throws(() => named.filter('queryOnly', { name: 'queryOnly', query: {} }, [], {}), /named query \(name=queryOnly\) does not define a filter/);
        })
    })

    describe('operation and modify', function() {
        const session_ = { snapshot: () => ({ id: 's1' }) };

        const def = {
            name: 'unittest.touch',
            parameters: {
                session_: { type: 'state' },
                ts: { type: 'timestamp', optional: true },
                val: { type: 'any' },
            },
            modify: (item$, args) => {
                received = args;

                return { ...item$, ts: args.ts };
            },
            operation: args => {
                received = args;

                return { Update: {} };
            },
        };

        it('operation passes the coerced request to the definition and returns its command', function() {
            assert.deepStrictEqual(named.operation('unittest.touch', def, { name: 'unittest.touch', session_, ts: '1000', val: 0 }), { Update: {} });
            assert.deepStrictEqual(received, { name: 'unittest.touch', session_, ts: 1000, val: 0 });
        })

        it('modify passes the item and the coerced request to the definition and returns its item', function() {
            assert.deepStrictEqual(named.modify('unittest.touch', def, { id: 's1' }, { session_, ts: '1000', val: 'x' }), { id: 's1', ts: 1000 });
            assert.deepStrictEqual(received, { session_, ts: 1000, val: 'x' });
        })

        it('reports every failing parameter, without running the definition', function() {
            assert.throws(() => named.operation('unittest.touch', def, { session_: { id: 's1' }, ts: 'someday' }), invalid([
                { property: 'session_', rule: 'isState' },
                { property: 'ts', rule: 'isTimestamp' },
                { property: 'val', rule: 'required' },
            ]));
            assert.strictEqual(received, undefined);
        })

        // NOTE: as for a param, a blank (null or '') required argument counts as missing, even of type any
        it('reports a blank required parameter as required', function() {
            assert.throws(() => named.modify('unittest.touch', def, {}, { session_, val: null }), invalid([{ property: 'val', rule: 'required' }]));
        })

        it('calls a definition that is a function as it is', function() {
            assert.deepStrictEqual(named.operation('fn', request => ({ Update: request.key }), { key: 'k' }), { Update: 'k' });
            assert.deepStrictEqual(named.modify('fn', (item$, request) => ({ ...item$, a: request.a }), { id: 1 }, { a: 2 }), { id: 1, a: 2 });
        })

        it('fails an assert for a definition without the implementation', function() {
            assert.throws(() => named.operation('modifyOnly', { name: 'modifyOnly', modify: item$ => item$ }, {}), /named operation \(name=modifyOnly\) does not define a DynamoDB implementation/);
            assert.throws(() => named.modify('operationOnly', { name: 'operationOnly', operation: {} }, {}, {}), /named operation \(name=operationOnly\) does not define modify/);
        })
    })

    describe('configure', function() {
        it('adds the definitions as they are', function() {
            const target = {};
            const def = { name: 'a', parameters: { type: 'string' }, query: {} };
            const fn = () => ({});

            named.configure('query', target, { a: def }, { fn });

            assert.strictEqual(target.a, def);
            assert.strictEqual(target.fn, fn);
        })

        it('fails an assert for a parameter type that is not defined', function() {
            const target = {};
            const bad = { name: 'unittest.bad', parameters: { to: { type: 'email' } }, query: {} };

            assert.throws(() => named.configure('query', target, { 'unittest.bad': bad }), e => e.name === 'AssertionError' && /query parameter type is not defined \(query=unittest.bad; parameter=to; type=email\)/.test(e.message));
            assert.throws(() => named.configure('operation', target, { 'unittest.bad': bad }), /operation parameter type is not defined \(operation=unittest.bad/);
            assert.strictEqual(target['unittest.bad'], undefined);
        })
    })
})
