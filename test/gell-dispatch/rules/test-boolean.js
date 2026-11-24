const assert = require('assert');

const boolean = require('../../../gell-dispatch/rules/boolean');

describe('boolean rules', function() {
    it('passes true and false', function() {
        assert.strictEqual(boolean.check('pinned', true), undefined);
        assert.strictEqual(boolean.check('pinned', false), undefined);
    })

    it('passes "true" and "false" (GET arguments)', function() {
        assert.strictEqual(boolean.check('pinned', 'true'), undefined);
        assert.strictEqual(boolean.check('pinned', 'false'), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(boolean.check('pinned', ''), undefined);
        assert.strictEqual(boolean.check('pinned', null), undefined);
    })

    it('fails anything else', function() {
        for (const val of ['yes', 'TRUE', 1, 0, {}, []]) {
            assert.deepStrictEqual(boolean.check('pinned', val), { rule: 'type', message: 'pinned must be true or false' }, JSON.stringify(val));
        }
    })
})
