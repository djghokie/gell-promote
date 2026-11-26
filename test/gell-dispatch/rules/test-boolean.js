const assert = require('assert');

const boolean = require('../../../gell-dispatch/rules/boolean');
const type = require('../../../gell-dispatch/rules/type');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        type.validate(boolean, val, rules);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('boolean rules', function() {
    it('passes true and false', function() {
        assert.strictEqual(check('pinned', true), undefined);
        assert.strictEqual(check('pinned', false), undefined);
    })

    it('passes "true" and "false" (GET arguments)', function() {
        assert.strictEqual(check('pinned', 'true'), undefined);
        assert.strictEqual(check('pinned', 'false'), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(check('pinned', ''), undefined);
        assert.strictEqual(check('pinned', null), undefined);
    })

    it('fails anything else', function() {
        for (const val of ['yes', 'TRUE', 1, 0, {}, []]) {
            assert.deepStrictEqual(check('pinned', val), { rule: 'isBoolean', message: 'pinned must be true or false' }, JSON.stringify(val));
        }
    })
})
