const assert = require('assert');

const number = require('../../../gell-dispatch/rules/number');

describe('number rules', function() {
    it('passes a number without rules', function() {
        assert.strictEqual(number.check('limit', 12), undefined);
    })

    it('passes a numeric string (a GET argument)', function() {
        assert.strictEqual(number.check('limit', '12'), undefined);
        assert.strictEqual(number.check('limit', '1.5'), undefined);
    })

    it('fails a value that is not a number', function() {
        assert.deepStrictEqual(number.check('limit', 'abc'), { rule: 'type', message: 'limit must be a number' });
        assert.deepStrictEqual(number.check('limit', '  '), { rule: 'type', message: 'limit must be a number' });
        assert.deepStrictEqual(number.check('limit', true), { rule: 'type', message: 'limit must be a number' });
        assert.deepStrictEqual(number.check('limit', {}), { rule: 'type', message: 'limit must be a number' });
        assert.deepStrictEqual(number.check('limit', Infinity), { rule: 'type', message: 'limit must be a number' });
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(number.check('limit', '', { min: 1 }), undefined);
        assert.strictEqual(number.check('limit', null, { min: 1 }), undefined);
    })

    it('checks the type before the rules', function() {
        assert.strictEqual(number.check('limit', 'abc', { min: 1 }).rule, 'type');
    })

    it('min', function() {
        assert.deepStrictEqual(number.check('limit', 0, { min: 1 }), { rule: 'min', message: 'limit must be at least 1' });
        assert.deepStrictEqual(number.check('limit', '0', { min: 1 }), { rule: 'min', message: 'limit must be at least 1' });
        assert.strictEqual(number.check('limit', 1, { min: 1 }), undefined);
        assert.strictEqual(number.check('limit', 0, { min: 0 }), undefined);
    })

    it('max', function() {
        assert.deepStrictEqual(number.check('limit', 1001, { max: 1000 }), { rule: 'max', message: 'limit must be at most 1000' });
        assert.strictEqual(number.check('limit', '1000', { max: 1000 }), undefined);
    })

    it('reports the first failing rule', function() {
        assert.strictEqual(number.check('limit', 5, { min: 10, max: 1 }).rule, 'min');
    })

    it('lists its rules in the order they are checked', function() {
        assert.deepStrictEqual(number.RULES.map(([rule]) => rule), ['min', 'max']);
    })
})
