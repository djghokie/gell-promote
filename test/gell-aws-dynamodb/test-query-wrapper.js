const assert = require('assert');

const queryWrapper = require('../../gell-aws-dynamodb/query-wrapper');

const PARENT_ID = '3f2b8c1e-9d4a-4e6b-8a7c-1d2e3f4a5b6c';

/**
 * Matches the ObjectValidationError a wrapped query throws
 */
function invalid(errors) {
    return e => {
        assert.strictEqual(e.name, 'ObjectValidationError');
        assert.deepStrictEqual(e.errors.map(({ property, rule }) => ({ property, rule })), errors);

        return true;
    }
}

describe('gell-aws-dynamodb/query-wrapper', function() {
    let queried, filtered;

    const def = {
        name: 'unittest.by.type',
        parameters: {
            type: { type: 'string', validate: { minLength: 4 } },
            limit: { type: 'number', optional: true, validate: { min: 1 } },
            parentId: { type: 'uuid', optional: true },
        },
        filter: (items, args) => {
            filtered = args;

            return items.filter(item$ => item$.type === args.type);
        },
        query: args => {
            queried = args;

            return { table: 'session', hash: args.type };
        },
    };

    beforeEach(function() {
        queried = undefined;
        filtered = undefined;
    })

    describe('dynamodb', function() {
        const { 'unittest.by.type': query } = queryWrapper.dynamodb({ 'unittest.by.type': def });

        it('passes the coerced args to query and returns its result', function() {
            assert.deepStrictEqual(query({ type: 'GELL#SESSION', limit: '2', parentId: PARENT_ID }), { table: 'session', hash: 'GELL#SESSION' });
            assert.deepStrictEqual(queried, { type: 'GELL#SESSION', limit: 2, parentId: PARENT_ID });
        })

        it('does not add an omitted optional parameter', function() {
            query({ type: 'GELL#SESSION' });

            assert.deepStrictEqual(queried, { type: 'GELL#SESSION' });
        })

        it('reports every failing parameter', function() {
            assert.throws(() => query({ limit: -5, parentId: 'note-1' }), invalid([
                { property: 'type', rule: 'required' },
                { property: 'limit', rule: 'min' },
                { property: 'parentId', rule: 'isUuid' },
            ]));
            assert.strictEqual(queried, undefined);
        })

        it('reports a required parameter of a call without args', function() {
            assert.throws(() => query(), invalid([{ property: 'type', rule: 'required' }]));
        })

        it('returns a query that is not a function', function() {
            const { fixed } = queryWrapper.dynamodb({ fixed: { name: 'fixed', parameters: {}, query: { table: 'session' } } });

            assert.deepStrictEqual(fixed(), { table: 'session' });
        })

        it('fails an assert for a definition without a DynamoDB query', function() {
            const { filterOnly } = queryWrapper.dynamodb({ filterOnly: { name: 'filterOnly', parameters: {}, filter: items => items } });

            assert.throws(() => filterOnly({}), /named query \(name=filterOnly\) does not define a DynamoDB implementation/);
        })
    })

    describe('ut', function() {
        const { 'unittest.by.type': query } = queryWrapper.ut({ 'unittest.by.type': def });

        const items = [{ type: 'GELLO' }, { type: 'FOOBAR' }];

        it('passes the coerced args to filter and returns its result', function() {
            assert.deepStrictEqual(query(items, { type: 'FOOBAR', limit: '10' }), [{ type: 'FOOBAR' }]);
            assert.deepStrictEqual(filtered, { type: 'FOOBAR', limit: 10 });
        })

        it('reports every failing parameter', function() {
            assert.throws(() => query(items, { type: 'FOO', limit: 0 }), invalid([
                { property: 'type', rule: 'minLength' },
                { property: 'limit', rule: 'min' },
            ]));
        })
    })

    describe('definitions', function() {
        it('fails an assert for a parameter type that is not defined, when wrapping', function() {
            const bad = { name: 'unittest.bad', parameters: { to: { type: 'email' } }, query: () => ({}), filter: items => items };

            assert.throws(() => queryWrapper.dynamodb({ 'unittest.bad': bad }), e => e.name === 'AssertionError' && /query parameter type is not defined \(query=unittest.bad; parameter=to; type=email\)/.test(e.message));
            assert.throws(() => queryWrapper.ut({ 'unittest.bad': bad }), /query parameter type is not defined/);
        })

        it('passes args through for a definition without parameters', function() {
            const { open } = queryWrapper.ut({ open: { name: 'open', filter: (items, args) => args } });

            assert.deepStrictEqual(open([], { a: 1 }), { a: 1 });
        })

        it('accepts a parameter declared by its type name', function() {
            const { short } = queryWrapper.ut({ short: { name: 'short', parameters: { type: 'string' }, filter: (items, args) => args } });

            assert.deepStrictEqual(short([], { type: 'X' }), { type: 'X' });
            assert.throws(() => short([], {}), invalid([{ property: 'type', rule: 'required' }]));
        })

        it('registers a definition that is a function as it is', function() {
            const fn = () => ({ table: 'session' });

            assert.strictEqual(queryWrapper.dynamodb({ fn }).fn, fn);
            assert.strictEqual(queryWrapper.ut({ fn }).fn, fn);
        })
    })
})
