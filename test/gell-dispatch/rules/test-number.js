const assert = require('assert');

const number = require('../../../gell-dispatch/rules/number');
const type = require('../../../gell-dispatch/rules/type');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        type.validate(number, val, rules);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('number rules', function() {
    it('passes a number without rules', function() {
        assert.strictEqual(check('limit', 12), undefined);
    })

    it('passes a numeric string (a GET argument)', function() {
        assert.strictEqual(check('limit', '12'), undefined);
        assert.strictEqual(check('limit', '1.5'), undefined);
    })

    it('fails a value that is not a number', function() {
        assert.deepStrictEqual(check('limit', 'abc'), { rule: 'isNumber', message: 'limit must be a number' });
        assert.deepStrictEqual(check('limit', '  '), { rule: 'isNumber', message: 'limit must be a number' });
        assert.deepStrictEqual(check('limit', true), { rule: 'isNumber', message: 'limit must be a number' });
        assert.deepStrictEqual(check('limit', {}), { rule: 'isNumber', message: 'limit must be a number' });
        assert.deepStrictEqual(check('limit', Infinity), { rule: 'isNumber', message: 'limit must be a number' });
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(check('limit', '', { min: 1 }), undefined);
        assert.strictEqual(check('limit', null, { min: 1 }), undefined);
    })

    it('checks the type before the rules', function() {
        assert.strictEqual(check('limit', 'abc', { min: 1 }).rule, 'isNumber');
    })

    it('min', function() {
        assert.deepStrictEqual(check('limit', 0, { min: 1 }), { rule: 'min', message: 'limit must be at least 1' });
        assert.deepStrictEqual(check('limit', '0', { min: 1 }), { rule: 'min', message: 'limit must be at least 1' });
        assert.strictEqual(check('limit', 1, { min: 1 }), undefined);
        assert.strictEqual(check('limit', 0, { min: 0 }), undefined);
    })

    it('max', function() {
        assert.deepStrictEqual(check('limit', 1001, { max: 1000 }), { rule: 'max', message: 'limit must be at most 1000' });
        assert.strictEqual(check('limit', '1000', { max: 1000 }), undefined);
    })

    it('enum, compared as numbers', function() {
        assert.deepStrictEqual(check('size', 3, { enum: [1, 2, 4] }), { rule: 'enum', message: 'size must be one of 1, 2, 4' });
        assert.deepStrictEqual(check('size', '3', { enum: [1, 2, 4] }), { rule: 'enum', message: 'size must be one of 1, 2, 4' });
        assert.strictEqual(check('size', 4, { enum: [1, 2, 4] }), undefined);
        assert.strictEqual(check('size', '4', { enum: [1, 2, 4] }), undefined);
        assert.strictEqual(check('size', 0.5, { enum: [0.5, 1] }), undefined);
    })

    it('reports the first failing rule', function() {
        assert.strictEqual(check('limit', 5, { min: 10, max: 1 }).rule, 'min');
    })

    it('lists its rules in the order they are checked, the type check first', function() {
        assert.deepStrictEqual(Object.keys(number.rules), ['isNumber', 'min', 'max', 'enum']);
        assert.deepStrictEqual(number.default, ['isNumber']);
    })
})
