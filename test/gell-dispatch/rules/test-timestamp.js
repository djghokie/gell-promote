const assert = require('assert');

const timestamp = require('../../../gell-dispatch/rules/timestamp');
const type = require('../../../gell-dispatch/rules/type');

/**
 * The failure of an argument, named like the arguments middleware names it
 */
function check(name, val, rules) {
    try {
        type.validate(timestamp, val, rules);
    } catch (e) {
        if (e.name !== 'RuleValidationError') throw e;

        return { rule: e.rule, message: `${name} ${e.message}` };
    }
}

describe('timestamp rules', function() {
    const JAN_1 = Date.UTC(2026, 0, 1);

    it('passes epoch milliseconds', function() {
        assert.strictEqual(check('dueTs', JAN_1), undefined);
    })

    it('passes a numeric string as epoch milliseconds (a GET argument)', function() {
        assert.strictEqual(timestamp.coerce(String(JAN_1)), JAN_1);
        assert.strictEqual(check('dueTs', String(JAN_1)), undefined);
    })

    it('passes a date string', function() {
        assert.strictEqual(timestamp.coerce('2026-01-01T00:00:00Z'), JAN_1);
        assert.strictEqual(check('dueTs', '2026-01-01'), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(check('dueTs', ''), undefined);
        assert.strictEqual(check('dueTs', null), undefined);
    })

    it('fails a value that is not a date', function() {
        assert.deepStrictEqual(check('dueTs', 'someday'), { rule: 'isTimestamp', message: 'dueTs is not a valid date' });
        assert.strictEqual(check('dueTs', true).rule, 'isTimestamp');
        assert.strictEqual(check('dueTs', {}).rule, 'isTimestamp');
    })

    it('min, as a date string or epoch milliseconds', function() {
        assert.deepStrictEqual(check('dueTs', '2025-12-31T00:00:00Z', { min: '2026-01-01T00:00:00Z' }), { rule: 'min', message: 'dueTs must be on or after 2026-01-01T00:00:00.000Z' });
        assert.strictEqual(check('dueTs', JAN_1, { min: JAN_1 }), undefined);
        assert.strictEqual(check('dueTs', JAN_1 - 1, { min: JAN_1 }).rule, 'min');
    })

    it('max', function() {
        assert.deepStrictEqual(check('dueTs', JAN_1 + 1, { max: JAN_1 }), { rule: 'max', message: 'dueTs must be on or before 2026-01-01T00:00:00.000Z' });
        assert.strictEqual(check('dueTs', JAN_1, { max: '2026-01-01T00:00:00Z' }), undefined);
    })

    it('lists its rules in the order they are checked, the type check first', function() {
        assert.deepStrictEqual(Object.keys(timestamp.rules), ['isTimestamp', 'min', 'max']);
        assert.deepStrictEqual(timestamp.default, ['isTimestamp']);
    })
})
