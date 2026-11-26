const assert = require('assert');

const object = require('../../../gell-dispatch/rules/object');
const type = require('../../../gell-dispatch/rules/type');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        type.validate(object, val, rules);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('object rules', function() {
    it('passes a plain object', function() {
        assert.strictEqual(check('address', { city: 'Denver' }), undefined);
    })

    it('passes an array', function() {
        assert.strictEqual(check('items', [{ text: 'a' }]), undefined);
    })

    it('passes a JSON string of an object or array (a GET argument)', function() {
        assert.strictEqual(check('args', '{"type":"x"}'), undefined);
        assert.strictEqual(check('args', '[1,2]'), undefined);
        assert.deepStrictEqual(object.coerce('{"type":"x"}'), { type: 'x' });
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(check('address', ''), undefined);
        assert.strictEqual(check('address', null), undefined);
    })

    it('fails anything else', function() {
        for (const val of ['Denver', '"a string"', '7', 'not json {', 7, true, new Date()]) {
            assert.deepStrictEqual(check('address', val), { rule: 'isObject', message: 'address must be an object' }, String(val));
        }
    })

    it('requiredKeys names every missing (or blank) key', function() {
        assert.deepStrictEqual(check('address', { street: '1 Main' }, { requiredKeys: ['city', 'zip'] }), { rule: 'requiredKeys', message: 'address must have city, zip' });
        assert.deepStrictEqual(check('address', { city: '', zip: '80202' }, { requiredKeys: ['city', 'zip'] }), { rule: 'requiredKeys', message: 'address must have city' });
        assert.strictEqual(check('address', { city: 'Denver', zip: '80202' }, { requiredKeys: ['city', 'zip'] }), undefined);
    })

    it('requiredKeys checks a JSON string argument', function() {
        assert.strictEqual(check('address', '{"street":"1 Main"}', { requiredKeys: ['city'] }).rule, 'requiredKeys');
    })

    it('requiredKeys does not apply to an array', function() {
        assert.strictEqual(check('items', [], { requiredKeys: ['city'] }), undefined);
    })

    it('lists its rules in the order they are checked, the type check first', function() {
        assert.deepStrictEqual(Object.keys(object.rules), ['isObject', 'requiredKeys']);
        assert.deepStrictEqual(object.default, ['isObject']);
    })
})
