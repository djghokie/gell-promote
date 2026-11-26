const assert = require('assert');

const operationWrapper = require('../../gell-aws-dynamodb/operation-wrapper');

/**
 * Matches the ObjectValidationError a wrapped operation throws
 */
function invalid(errors) {
    return e => {
        assert.strictEqual(e.name, 'ObjectValidationError');
        assert.deepStrictEqual(e.errors.map(({ property, rule }) => ({ property, rule })), errors);

        return true;
    }
}

describe('gell-aws-dynamodb/operation-wrapper', function() {
    let operated, modified;

    const session_ = { snapshot: () => ({ id: 's1' }) };

    const def = {
        name: 'unittest.touch',
        parameters: {
            session_: { type: 'state' },
            ts: { type: 'timestamp', optional: true },
            val: { type: 'any' },
        },
        modify: (item$, args) => {
            modified = args;

            return { ...item$, ts: args.ts };
        },
        operation: args => {
            operated = args;

            return { type: 'update' };
        },
    };

    beforeEach(function() {
        operated = undefined;
        modified = undefined;
    })

    describe('dynamodb', function() {
        const { 'unittest.touch': operation } = operationWrapper.dynamodb({ 'unittest.touch': def });

        it('passes the coerced args to operation and returns its result', function() {
            assert.deepStrictEqual(operation({ session_, ts: '1000', val: 0 }), { type: 'update' });
            assert.deepStrictEqual(operated, { session_, ts: 1000, val: 0 });
            assert.strictEqual(operated.session_, session_);
        })

        it('reports every failing parameter', function() {
            assert.throws(() => operation({ session_: { id: 's1' }, ts: 'someday' }), invalid([
                { property: 'session_', rule: 'isState' },
                { property: 'ts', rule: 'isTimestamp' },
                { property: 'val', rule: 'required' },
            ]));
            assert.strictEqual(operated, undefined);
        })

        // NOTE: as for a param, a blank (null or '') required argument counts as missing, even of type any
        it('reports a blank required parameter as required', function() {
            assert.throws(() => operation({ session_, val: null }), invalid([{ property: 'val', rule: 'required' }]));
            assert.throws(() => operation({ session_, val: '' }), invalid([{ property: 'val', rule: 'required' }]));
        })

        it('fails an assert for a definition without a DynamoDB operation', function() {
            const { modifyOnly } = operationWrapper.dynamodb({ modifyOnly: { name: 'modifyOnly', parameters: {}, modify: item$ => item$ } });

            assert.throws(() => modifyOnly({}), /named operation \(name=modifyOnly\) does not define a DynamoDB implementation/);
        })
    })

    describe('ut', function() {
        const { 'unittest.touch': operation } = operationWrapper.ut({ 'unittest.touch': def });

        it('passes the item and the coerced args to modify and returns its result', function() {
            const item$ = { id: 's1' };

            assert.deepStrictEqual(operation(item$, { session_, ts: '1000', val: 'x' }), { id: 's1', ts: 1000 });
            assert.deepStrictEqual(modified, { session_, ts: 1000, val: 'x' });
        })

        it('reports a required parameter of a call without args', function() {
            assert.throws(() => operation({ id: 's1' }), invalid([
                { property: 'session_', rule: 'required' },
                { property: 'val', rule: 'required' },
            ]));
        })
    })

    describe('definitions', function() {
        it('fails an assert for a parameter type that is not defined, when wrapping', function() {
            const bad = { name: 'unittest.bad', parameters: { to: { type: 'email' } }, operation: () => ({}), modify: item$ => item$ };

            assert.throws(() => operationWrapper.dynamodb({ 'unittest.bad': bad }), e => e.name === 'AssertionError' && /operation parameter type is not defined \(operation=unittest.bad; parameter=to; type=email\)/.test(e.message));
            assert.throws(() => operationWrapper.ut({ 'unittest.bad': bad }), /operation parameter type is not defined/);
        })

        it('registers a definition that is a function as it is', function() {
            const fn = () => ({ type: 'update' });

            assert.strictEqual(operationWrapper.dynamodb({ fn }).fn, fn);
            assert.strictEqual(operationWrapper.ut({ fn }).fn, fn);
        })
    })
})
