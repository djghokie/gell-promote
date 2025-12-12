const assert = require('assert');
const _ = require('lodash');

const stream = require('gell/stream/stream');
const { array: arraySink } = require('gell/stream/sink');

const standard = require('gell-calendar/standard');
const timeperiod = require('gell-calendar/domain/timeperiod');

const { add, format } = require('date-fns');

function* instanceGenerator(def) {
    var d = new Date('12/01/2024');

    while (true) {
        yield format(d, def.foramt)

        d = add(d, def.duration);
    }
}

describe('month time period', function() {
    beforeEach(function() {
    })

    it('generates correct MONTH time periods', async function() {
        const def = {
            foramt: 'yyyy-MM',
            duration: { months: 1 }
        };

        const $instances = instanceGenerator(def);

        const timePeriods = [];

        await stream($instances)
            .sample(5)
            .sink(arraySink(timePeriods));

// console.debug('#####', timePeriods);

        assert.strictEqual(timePeriods.length, 5);
        assert.strictEqual(timePeriods[0], '2024-12');
        assert.strictEqual(timePeriods[1], '2025-01');
        assert.strictEqual(timePeriods[2], '2025-02');
        assert.strictEqual(timePeriods[3], '2025-03');
        assert.strictEqual(timePeriods[4], '2025-04');
    })

    it('with timeperiod domain', async function() {
        const month_ = timeperiod.materialize(standard.month);

        const $instances = month_.forward(new Date('12/01/2024'));
        const instances_ = [];

        await stream($instances)
            .sample(5)
            .sink(arraySink(instances_));

        const timePeriods = instances_.map(i_ => i_.snapshot()).map(i$ => format(i$.startTs, standard.month.sortFormat));

        assert.strictEqual(timePeriods.length, 5);
        assert.strictEqual(timePeriods[0], '2024-12');
        assert.strictEqual(timePeriods[1], '2025-01');
        assert.strictEqual(timePeriods[2], '2025-02');
        assert.strictEqual(timePeriods[3], '2025-03');
        assert.strictEqual(timePeriods[4], '2025-04');
    })
})