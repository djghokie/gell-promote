const assert = require('assert');

const object = require('../../../gell-dispatch/rules/object');

describe('object rules', function() {
    it('passes a plain object', function() {
        assert.strictEqual(object.check('address', { city: 'Denver' }), undefined);
    })

    it('passes an array', function() {
        assert.strictEqual(object.check('items', [{ text: 'a' }]), undefined);
    })

    it('passes a JSON string of an object or array (a GET argument)', function() {
        assert.strictEqual(object.check('args', '{"type":"x"}'), undefined);
        assert.strictEqual(object.check('args', '[1,2]'), undefined);
        assert.deepStrictEqual(object.toObject('{"type":"x"}'), { type: 'x' });
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(object.check('address', ''), undefined);
        assert.strictEqual(object.check('address', null), undefined);
    })

    it('fails anything else', function() {
        for (const val of ['Denver', '"a string"', '7', 'not json {', 7, true, new Date()]) {
            assert.deepStrictEqual(object.check('address', val), { rule: 'type', message: 'address must be an object' }, String(val));
        }
    })

    it('requiredKeys names every missing (or blank) key', function() {
        assert.deepStrictEqual(object.check('address', { street: '1 Main' }, { requiredKeys: ['city', 'zip'] }), { rule: 'requiredKeys', message: 'address must have city, zip' });
        assert.deepStrictEqual(object.check('address', { city: '', zip: '80202' }, { requiredKeys: ['city', 'zip'] }), { rule: 'requiredKeys', message: 'address must have city' });
        assert.strictEqual(object.check('address', { city: 'Denver', zip: '80202' }, { requiredKeys: ['city', 'zip'] }), undefined);
    })

    it('requiredKeys checks a JSON string argument', function() {
        assert.strictEqual(object.check('address', '{"street":"1 Main"}', { requiredKeys: ['city'] }).rule, 'requiredKeys');
    })

    it('requiredKeys does not apply to an array', function() {
        assert.strictEqual(object.check('items', [], { requiredKeys: ['city'] }), undefined);
    })

    it('lists its rules in the order they are checked', function() {
        assert.deepStrictEqual(object.RULES.map(([rule]) => rule), ['requiredKeys']);
    })
})
