const assert = require('assert');

const array = require('../../../gell-dispatch/rules/array');
const type = require('../../../gell-dispatch/rules/type');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        type.validate(array, val, rules);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('array rules', function() {
    it('passes an array', function() {
        assert.strictEqual(check('tags', []), undefined);
        assert.strictEqual(check('tags', ['a', 'b']), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(check('tags', ''), undefined);
        assert.strictEqual(check('tags', null), undefined);
    })

    it('fails anything else, including a JSON string', function() {
        for (const val of ['["a"]', 'a', {}, 1, true]) {
            assert.deepStrictEqual(check('tags', val), { rule: 'isArray', message: 'tags must be an array' }, JSON.stringify(val));
        }
    })

    it('minItems', function() {
        assert.deepStrictEqual(check('tags', [], { minItems: 1 }), { rule: 'minItems', message: 'tags cannot be empty' });
        assert.deepStrictEqual(check('tags', ['a'], { minItems: 2 }), { rule: 'minItems', message: 'tags must have at least 2 items' });
        assert.strictEqual(check('tags', ['a', 'b'], { minItems: 2 }), undefined);
    })

    it('maxItems', function() {
        assert.deepStrictEqual(check('tags', ['a', 'b', 'c'], { maxItems: 2 }), { rule: 'maxItems', message: 'tags must have at most 2 items' });
        assert.strictEqual(check('tags', ['a', 'b'], { maxItems: 2 }), undefined);
    })

    // NOTE: items is checked by the arguments middleware (test/gell-dispatch/middleware/test-arguments.js)

    it('lists its rules in the order they are checked, the type check first', function() {
        assert.deepStrictEqual(Object.keys(array.rules), ['isArray', 'minItems', 'maxItems']);
        assert.deepStrictEqual(array.default, ['isArray']);
    })
})
