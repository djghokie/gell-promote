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
        type.validate('abc', { minLength: 2, maxLength: 5 }, TYPE);
    })

    it('runs the default rules first, in their order', function() {
        assert.throws(() => type.validate(7, { minLength: 2 }, TYPE), failure('isString', 'must be a string'));
        assert.throws(() => type.validate('a b', { minLength: 5 }, TYPE), failure('isWord', 'must be one word (value=a b)'));
    })

    it('runs the default rules without a spec', function() {
        assert.throws(() => type.validate(7, undefined, TYPE), failure('isString', 'must be a string'));
    })

    it('checks the spec rules in the order spec declares them', function() {
        assert.throws(() => type.validate('a', { maxLength: 0, minLength: 2 }, TYPE), failure('maxLength', 'must be at most 0 characters'));
        assert.throws(() => type.validate('a', { minLength: 2, maxLength: 0 }, TYPE), failure('minLength', 'must be at least 2 characters'));
    })

    it('rejects a rule the type does not define', function() {
        assert.throws(() => type.validate('abc', { pattern: '^a' }, TYPE), e => e.name === 'AssertionError' && /no rule defined \(type=word; rule=pattern\)/.test(e.message));
    })

    it('rejects the reserved keys (the caller leaves them out)', function() {
        assert.deepStrictEqual(type.RESERVED, ['messages', 'items']);
        assert.throws(() => type.validate('abc', { messages: {} }, TYPE), /no rule defined/);
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
            type.validate('', { min: 1 }, NUMBER);
            type.validate(null, { min: 1 }, NUMBER);
        })

        it('checks a blank argument when the type does not allow blanks', function() {
            assert.throws(() => type.validate(null, undefined, TYPE), failure('isString', 'must be a string'));
            assert.throws(() => type.validate('', { minLength: 1 }, TYPE), failure('minLength', 'must be at least 1 characters'));
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
            type.validate('5', { max: 10 }, NUMBER);
        })

        it('passes the coerced argument to messages', function() {
            assert.throws(() => type.validate('12', { max: 10 }, NUMBER), failure('max', '12 must be at most 10'));
            assert.throws(() => type.validate('x', undefined, NUMBER), failure('isNumber', 'must be a number (value=NaN)'));
        })
    })

    describe('rule arguments', function() {
        const NUMBER = {
            name: 'number',
            rules: {
                isNumber: { default: true, test: n => Number.isFinite(n), message: () => 'must be a number' },
                max: { type: 'number', test: (n, max) => n <= max, message: (n, max) => `must be at most ${max} (${typeof max})` },
                enum: { type: ['number'], test: (n, values) => values.includes(n), message: (n, values) => `must be one of ${values.join(', ')}` },
                label: { type: 'nonsense', test: (n, label) => label === '7', message: () => 'label' },
            },
            default: ['isNumber'],
            coerce: val => typeof val === 'string' ? Number(val) : val,
        };

        it('are coerced with the type the rule names', function() {
            type.validate(10, { max: '10' }, NUMBER);
            assert.throws(() => type.validate(11, { max: '10' }, NUMBER), failure('max', 'must be at most 10 (number)'));
        })

        it('are coerced item by item for an array type', function() {
            type.validate(2, { enum: ['1', '2'] }, NUMBER);
            assert.throws(() => type.validate(3, { enum: ['1', 2] }, NUMBER), failure('enum', 'must be one of 1, 2'));
        })

        it('are left as declared for a type that is not registered', function() {
            assert.strictEqual(type.TYPES.nonsense, undefined);
            type.validate(1, { label: '7' }, NUMBER);
        })

        it('must pass their type check (a bad one is a metadata error)', function() {
            assert.throws(() => type.validate(1, { max: 'someday' }, NUMBER), e => e.name === 'AssertionError' && e.message === 'rule argument is not a valid number (type=number; rule=max; argument="someday")');
            assert.throws(() => type.validate(1, { enum: [1, 'x'] }, NUMBER), /rule argument is not a valid number \(type=number; rule=enum; argument="x"\)/);
        })

        it('must be an array for an array type', function() {
            assert.throws(() => type.validate(1, { enum: 1 }, NUMBER), /rule argument is not an array \(type=number; rule=enum; argument=1\)/);
        })

        it('registers every param type', function() {
            assert.deepStrictEqual(Object.keys(type.TYPES), ['string', 'number', 'boolean', 'timestamp', 'array', 'object', 'integer']);
            Object.entries(type.TYPES).forEach(([name, TYPE]) => assert.strictEqual(TYPE.name, name));
        })
    })

    describe('extends', function() {
        const BASE = {
            name: 'base',
            allowBlank: true,
            rules: {
                isNumber: { test: n => Number.isFinite(n), message: () => 'must be a number' },
                min: { type: 'number', test: (n, min) => n >= min, message: (n, min) => `must be at least ${min}` },
                max: { type: 'number', test: (n, max) => n <= max, message: (n, max) => `must be at most ${max}` },
            },
            default: ['isNumber'],
            coerce: val => typeof val === 'string' ? Number(val) : val,
        };

        const CHILD = {
            name: 'child',
            extends: 'base',
            rules: {
                isEven: { test: n => n % 2 === 0, message: () => 'must be even' },
                max: { type: 'number', test: (n, max) => n < max, message: (n, max) => `must be below ${max}` },
                positive: { type: 'boolean', test: (n, apply, inherited) => !apply || inherited.min.test(n, 1), message: (n, apply, inherited) => inherited.min.message(n, 1) },
            },
            default: ['isEven'],
        };

        const GRANDCHILD = {
            name: 'grandchild',
            extends: 'child',
            rules: {
                small: { type: 'boolean', test: (n, apply, inherited) => !apply || (inherited.positive.test(n, true) && inherited.max.test(n, 10)), message: () => 'must be small' },
            },
        };

        const DEFINITIONS = { base: BASE, child: CHILD, grandchild: GRANDCHILD };
        const resolved = name => type.resolve(DEFINITIONS[name], DEFINITIONS);

        it("gets the parent's rules, its own replacing one of the same name", function() {
            assert.deepStrictEqual(Object.keys(resolved('child').rules), ['isNumber', 'min', 'max', 'isEven', 'positive']);
            assert.throws(() => type.validate(10, { max: 10 }, resolved('child')), failure('max', 'must be below 10'));
        })

        it("runs the parent's default rules first", function() {
            assert.deepStrictEqual(resolved('child').default, ['isNumber', 'isEven']);
            assert.throws(() => type.validate('x', undefined, resolved('child')), failure('isNumber', 'must be a number'));
            assert.throws(() => type.validate(3, undefined, resolved('child')), failure('isEven', 'must be even'));
        })

        it("gets the parent's allowBlank and coerce", function() {
            type.validate('', { min: 4 }, resolved('child'));
            type.validate('4', { min: 4 }, resolved('child'));
        })

        it("builds on the parent's rules by name (inherited)", function() {
            type.validate(2, { positive: true }, resolved('child'));
            assert.throws(() => type.validate(0, { positive: true }, resolved('child')), failure('positive', 'must be at least 1'));
        })

        it("gives an inherited rule its own level's inherited (a chain)", function() {
            const GRANDCHILD_TYPE = resolved('grandchild');

            assert.deepStrictEqual(GRANDCHILD_TYPE.default, ['isNumber', 'isEven']);
            type.validate(8, { small: true }, GRANDCHILD_TYPE);
            assert.throws(() => type.validate(0, { small: true }, GRANDCHILD_TYPE), failure('small', 'must be small'));
            // NOTE: child's max (below), not base's (at most)
            assert.throws(() => type.validate(10, { small: true }, GRANDCHILD_TYPE), failure('small', 'must be small'));
        })

        it('validate resolves a definition it is given', function() {
            const definition = { ...CHILD, extends: 'number' };

            assert.throws(() => type.validate(3, undefined, definition), failure('isEven', 'must be even'));
        })

        it('rejects a type to extend that is not defined', function() {
            assert.throws(() => type.resolve({ name: 'orphan', extends: 'nothing', rules: {} }, DEFINITIONS), /no type to extend \(type=orphan; extends=nothing\)/);
        })

        it('rejects a type that extends itself', function() {
            const LOOP = { a: { name: 'a', extends: 'b' }, b: { name: 'b', extends: 'a' } };

            assert.throws(() => type.resolve(LOOP.a, LOOP), /type extends itself \(type=a; chain=a > b > a\)/);
        })
    })

    it('isBlank', function() {
        assert.strictEqual(type.isBlank(''), true);
        assert.strictEqual(type.isBlank(null), true);
        assert.strictEqual(type.isBlank(undefined), false);
        assert.strictEqual(type.isBlank(0), false);
    })
})
