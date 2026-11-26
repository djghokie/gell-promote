const assert = require('assert');

const integer = require('../../../gell-dispatch/rules/integer');
const type = require('../../../gell-dispatch/rules/type');
const { argument } = require('../../../gell-dispatch/validate');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        argument(val, rules, type.TYPES.integer);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('integer rules', function() {
    it('extends number', function() {
        assert.strictEqual(integer.extends, 'number');
        assert.deepStrictEqual(type.TYPES.integer.default, ['isNumber', 'isInteger']);
        assert.deepStrictEqual(Object.keys(type.TYPES.integer.rules), ['isNumber', 'min', 'max', 'enum', 'isInteger', 'positive']);
    })

    it('passes an integer, including a numeric string (number coerce)', function() {
        assert.strictEqual(check('seats', 12), undefined);
        assert.strictEqual(check('seats', '12'), undefined);
        assert.strictEqual(check('seats', -3), undefined);
    })

    it('passes a blank (optional) argument (number allowBlank)', function() {
        assert.strictEqual(check('seats', '', { positive: true }), undefined);
        assert.strictEqual(check('seats', null), undefined);
    })

    it('checks number before integer', function() {
        assert.deepStrictEqual(check('seats', 'abc'), { rule: 'isNumber', message: 'seats must be a number' });
    })

    it('fails a number that is not an integer', function() {
        assert.deepStrictEqual(check('seats', 1.5), { rule: 'isInteger', message: 'seats must be an integer' });
        assert.deepStrictEqual(check('seats', '1.5'), { rule: 'isInteger', message: 'seats must be an integer' });
    })

    it('positive', function() {
        assert.deepStrictEqual(check('seats', 0, { positive: true }), { rule: 'positive', message: 'seats must be a positive number' });
        assert.strictEqual(check('seats', 1, { positive: true }), undefined);
        assert.strictEqual(check('seats', 0, { positive: false }), undefined);
        assert.strictEqual(check('seats', 0, { positive: 'false' }), undefined);
    })

    it('rejects a positive argument that is not a boolean', function() {
        assert.throws(() => check('seats', 1, { positive: 'maybe' }), /rule argument is not a valid boolean \(type=integer; rule=positive/);
    })

    it("number's rules", function() {
        assert.deepStrictEqual(check('seats', 13, { max: 12 }), { rule: 'max', message: 'seats must be at most 12' });
        assert.deepStrictEqual(check('seats', 3, { enum: [1, 2] }), { rule: 'enum', message: 'seats must be one of 1, 2' });
        assert.strictEqual(check('seats', '2', { enum: ['1', '2'] }), undefined);
    })
})
