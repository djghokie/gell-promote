const assert = require('assert');

const timestamp = require('../../../gell-dispatch/rules/timestamp');

describe('timestamp rules', function() {
    const JAN_1 = Date.UTC(2026, 0, 1);

    it('passes epoch milliseconds', function() {
        assert.strictEqual(timestamp.check('dueTs', JAN_1), undefined);
    })

    it('passes a numeric string as epoch milliseconds (a GET argument)', function() {
        assert.strictEqual(timestamp.toTs(String(JAN_1)), JAN_1);
        assert.strictEqual(timestamp.check('dueTs', String(JAN_1)), undefined);
    })

    it('passes a date string', function() {
        assert.strictEqual(timestamp.toTs('2026-01-01T00:00:00Z'), JAN_1);
        assert.strictEqual(timestamp.check('dueTs', '2026-01-01'), undefined);
    })

    it('passes a blank (optional) argument', function() {
        assert.strictEqual(timestamp.check('dueTs', ''), undefined);
        assert.strictEqual(timestamp.check('dueTs', null), undefined);
    })

    it('fails a value that is not a date', function() {
        assert.deepStrictEqual(timestamp.check('dueTs', 'someday'), { rule: 'type', message: 'dueTs is not a valid date (dueTs=someday)' });
        assert.strictEqual(timestamp.check('dueTs', true).rule, 'type');
        assert.strictEqual(timestamp.check('dueTs', {}).rule, 'type');
    })

    it('min, as a date string or epoch milliseconds', function() {
        assert.deepStrictEqual(timestamp.check('dueTs', '2025-12-31T00:00:00Z', { min: '2026-01-01T00:00:00Z' }), { rule: 'min', message: 'dueTs must be on or after 2026-01-01T00:00:00.000Z' });
        assert.strictEqual(timestamp.check('dueTs', JAN_1, { min: JAN_1 }), undefined);
        assert.strictEqual(timestamp.check('dueTs', JAN_1 - 1, { min: JAN_1 }).rule, 'min');
    })

    it('max', function() {
        assert.deepStrictEqual(timestamp.check('dueTs', JAN_1 + 1, { max: JAN_1 }), { rule: 'max', message: 'dueTs must be on or before 2026-01-01T00:00:00.000Z' });
        assert.strictEqual(timestamp.check('dueTs', JAN_1, { max: '2026-01-01T00:00:00Z' }), undefined);
    })

    it('lists its rules in the order they are checked', function() {
        assert.deepStrictEqual(timestamp.RULES.map(([rule]) => rule), ['min', 'max']);
    })
})
