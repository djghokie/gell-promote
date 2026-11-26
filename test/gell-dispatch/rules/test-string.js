const assert = require('assert');

const string = require('../../../gell-dispatch/rules/string');
const { argument } = require('../../../gell-dispatch/validate');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        argument(val, rules, string);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('string rules', function() {
    it('passes a string without rules', function() {
        assert.strictEqual(check('title', 'abc'), undefined);
    })

    it('fails a value that is not a string', function() {
        assert.deepStrictEqual(check('title', 7), { rule: 'isString', message: 'title must be a string' });
    })

    it('checks the type before the rules', function() {
        assert.deepStrictEqual(check('title', 7, { minLength: 3 }), { rule: 'isString', message: 'title must be a string' });
    })

    it('minLength', function() {
        assert.deepStrictEqual(check('title', 'ab', { minLength: 3 }), { rule: 'minLength', message: 'title must be at least 3 characters' });
        assert.deepStrictEqual(check('title', '', { minLength: 1 }), { rule: 'minLength', message: 'title cannot be empty' });
        assert.strictEqual(check('title', 'abc', { minLength: 3 }), undefined);
    })

    it('maxLength', function() {
        assert.deepStrictEqual(check('title', 'abc', { maxLength: 2 }), { rule: 'maxLength', message: 'title must be at most 2 characters' });
        assert.strictEqual(check('title', 'ab', { maxLength: 2 }), undefined);
    })

    it('pattern', function() {
        assert.deepStrictEqual(check('title', 'abc', { pattern: '^[A-Z]' }), { rule: 'pattern', message: 'title must match ^[A-Z]' });
        assert.strictEqual(check('title', 'Abc', { pattern: '^[A-Z]' }), undefined);
        assert.throws(() => check('title', '123', { pattern: /^\d+$/ }), /rule argument is not a valid string/);
    })

    it('reports the first failing rule', function() {
        assert.strictEqual(check('title', 'a', { minLength: 3, maxLength: 0, pattern: '^[A-Z]' }).rule, 'minLength');
    })

    it('enum', function() {
        assert.deepStrictEqual(check('color', 'plaid', { enum: ['red', 'blue'] }), { rule: 'enum', message: 'color must be one of red, blue' });
        assert.strictEqual(check('color', 'red', { enum: ['red', 'blue'] }), undefined);
    })

    it('rejects a rule it does not define', function() {
        assert.throws(() => check('title', 'abc', { min: 5 }), /no rule defined \(type=string; rule=min\)/);
    })

    it('lists its rules in the order they are checked, the type check first', function() {
        assert.deepStrictEqual(Object.keys(string.rules), ['isString', 'minLength', 'maxLength', 'pattern', 'enum']);
        assert.deepStrictEqual(string.default, ['isString']);
    })
})
