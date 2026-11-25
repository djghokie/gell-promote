const assert = require('assert');

const string = require('../../../gell-dispatch/rules/string');

describe('string rules', function() {
    it('passes a string without rules', function() {
        assert.strictEqual(string.check('title', 'abc'), undefined);
    })

    it('fails a value that is not a string', function() {
        assert.deepStrictEqual(string.check('title', 7), { rule: 'type', message: 'title must be a string' });
    })

    it('checks the type before the rules', function() {
        assert.deepStrictEqual(string.check('title', 7, { minLength: 3 }), { rule: 'type', message: 'title must be a string' });
    })

    it('minLength', function() {
        assert.deepStrictEqual(string.check('title', 'ab', { minLength: 3 }), { rule: 'minLength', message: 'title must be at least 3 characters' });
        assert.deepStrictEqual(string.check('title', '', { minLength: 1 }), { rule: 'minLength', message: 'title cannot be empty' });
        assert.strictEqual(string.check('title', 'abc', { minLength: 3 }), undefined);
    })

    it('maxLength', function() {
        assert.deepStrictEqual(string.check('title', 'abc', { maxLength: 2 }), { rule: 'maxLength', message: 'title must be at most 2 characters' });
        assert.strictEqual(string.check('title', 'ab', { maxLength: 2 }), undefined);
    })

    it('pattern', function() {
        assert.deepStrictEqual(string.check('title', 'abc', { pattern: '^[A-Z]' }), { rule: 'pattern', message: 'title must match ^[A-Z]' });
        assert.strictEqual(string.check('title', 'Abc', { pattern: '^[A-Z]' }), undefined);
        assert.strictEqual(string.check('title', '123', { pattern: /^\d+$/ }), undefined);
    })

    it('reports the first failing rule', function() {
        assert.strictEqual(string.check('title', 'a', { minLength: 3, maxLength: 0, pattern: '^[A-Z]' }).rule, 'minLength');
    })

    it('enum', function() {
        assert.deepStrictEqual(string.check('color', 'plaid', { enum: ['red', 'blue'] }), { rule: 'enum', message: 'color must be one of red, blue' });
        assert.strictEqual(string.check('color', 'red', { enum: ['red', 'blue'] }), undefined);
    })

    it('ignores rules it does not implement', function() {
        assert.strictEqual(string.check('title', 'abc', { min: 5, messages: { min: 'nope' } }), undefined);
    })

    it('lists its rules in the order they are checked', function() {
        assert.deepStrictEqual(string.RULES.map(([rule]) => rule), ['minLength', 'maxLength', 'pattern', 'enum']);
    })
})
