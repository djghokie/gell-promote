const assert = require('assert');

const array = require('../../../gell-dispatch/rules/array');

describe('array rules', function() {
    it('passes an array', function() {
        assert.strictEqual(array.check('tags', []), undefined);
        assert.strictEqual(array.check('tags', ['a', 'b']), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(array.check('tags', ''), undefined);
        assert.strictEqual(array.check('tags', null), undefined);
    })

    it('fails anything else, including a JSON string', function() {
        for (const val of ['["a"]', 'a', {}, 1, true]) {
            assert.deepStrictEqual(array.check('tags', val), { rule: 'type', message: 'tags must be an array' }, JSON.stringify(val));
        }
    })

    it('minItems', function() {
        assert.deepStrictEqual(array.check('tags', [], { minItems: 1 }), { rule: 'minItems', message: 'tags cannot be empty' });
        assert.deepStrictEqual(array.check('tags', ['a'], { minItems: 2 }), { rule: 'minItems', message: 'tags must have at least 2 items' });
        assert.strictEqual(array.check('tags', ['a', 'b'], { minItems: 2 }), undefined);
    })

    it('maxItems', function() {
        assert.deepStrictEqual(array.check('tags', ['a', 'b', 'c'], { maxItems: 2 }), { rule: 'maxItems', message: 'tags must have at most 2 items' });
        assert.strictEqual(array.check('tags', ['a', 'b'], { maxItems: 2 }), undefined);
    })

    it('lists its rules in the order they are checked', function() {
        assert.deepStrictEqual(array.RULES.map(([rule]) => rule), ['minItems', 'maxItems']);
    })
})
