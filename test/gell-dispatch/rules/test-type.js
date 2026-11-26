const assert = require('assert');

const type = require('../../../gell-dispatch/rules/type');

const TYPE = {
    name: 'word',
    rules: {
        isString: { default: true, test: val => typeof val === 'string', message: () => 'must be a string' },
        isWord: { default: true, test: val => /^\w*$/.test(val), message: val => `must be one word (value=${val})` },
        minLength: { type: 'number', test: (val, min) => val.length >= min, message: (val, min) => `must be at least ${min} characters` },
        maxLength: { type: 'number', test: (val, max) => val.length <= max, message: (val, max) => `must be at most ${max} characters` },
    },
    default: ['isString', 'isWord'],
};

/**
 * The RuleValidationError validate throws
 */
function failure(rule, message) {
    return e => {
        assert.strictEqual(e.name, 'RuleValidationError');
        assert.strictEqual(e.rule, rule);
        assert.strictEqual(e.message, message);

        return true;
    }
}

describe('rules type validate', function() {
    it('passes an argument that passes every rule', function() {
        type.validate(TYPE, 'abc', { minLength: 2, maxLength: 5 });
    })

    it('runs the default rules first, in their order', function() {
        assert.throws(() => type.validate(TYPE, 7, { minLength: 2 }), failure('isString', 'must be a string'));
        assert.throws(() => type.validate(TYPE, 'a b', { minLength: 5 }), failure('isWord', 'must be one word (value=a b)'));
    })

    it('runs the default rules without a spec', function() {
        assert.throws(() => type.validate(TYPE, 7), failure('isString', 'must be a string'));
    })

    it('checks the spec rules in the order spec declares them', function() {
        assert.throws(() => type.validate(TYPE, 'a', { maxLength: 0, minLength: 2 }), failure('maxLength', 'must be at most 0 characters'));
        assert.throws(() => type.validate(TYPE, 'a', { minLength: 2, maxLength: 0 }), failure('minLength', 'must be at least 2 characters'));
    })

    it('rejects a rule the type does not define', function() {
        assert.throws(() => type.validate(TYPE, 'abc', { pattern: '^a' }), e => e.name === 'AssertionError' && /no rule defined \(type=word; rule=pattern\)/.test(e.message));
    })

    it('rejects the reserved keys (the caller leaves them out)', function() {
        assert.deepStrictEqual(type.RESERVED, ['messages', 'items']);
        assert.throws(() => type.validate(TYPE, 'abc', { messages: {} }), /no rule defined/);
    })

    describe('allowBlank', function() {
        const NUMBER = {
            name: 'number',
            allowBlank: true,
            rules: {
                isNumber: { default: true, test: n => Number.isFinite(n), message: () => 'must be a number' },
                min: { type: 'number', test: (n, min) => n >= min, message: (n, min) => `must be at least ${min}` },
            },
            default: ['isNumber'],
        };

        it('passes a blank argument without its rules', function() {
            type.validate(NUMBER, '', { min: 1 });
            type.validate(NUMBER, null, { min: 1 });
        })

        it('checks a blank argument when the type does not allow blanks', function() {
            assert.throws(() => type.validate(TYPE, null), failure('isString', 'must be a string'));
            assert.throws(() => type.validate(TYPE, '', { minLength: 1 }), failure('minLength', 'must be at least 1 characters'));
        })
    })

    describe('coerce', function() {
        const NUMBER = {
            name: 'number',
            rules: {
                isNumber: { default: true, test: n => Number.isFinite(n), message: n => `must be a number (value=${n})` },
                max: { type: 'number', test: (n, max) => n <= max, message: (n, max) => `${n} must be at most ${max}` },
            },
            default: ['isNumber'],
            coerce: val => typeof val === 'string' ? Number(val) : val,
        };

        it('runs the rules on the coerced argument', function() {
            type.validate(NUMBER, '5', { max: 10 });
        })

        it('passes the coerced argument to messages', function() {
            assert.throws(() => type.validate(NUMBER, '12', { max: 10 }), failure('max', '12 must be at most 10'));
            assert.throws(() => type.validate(NUMBER, 'x'), failure('isNumber', 'must be a number (value=NaN)'));
        })
    })

    it('isBlank', function() {
        assert.strictEqual(type.isBlank(''), true);
        assert.strictEqual(type.isBlank(null), true);
        assert.strictEqual(type.isBlank(undefined), false);
        assert.strictEqual(type.isBlank(0), false);
    })
})
