const assert = require('assert');
const _ = require('lodash');

const materialize = require('gell/state/materialize');
const stream = require('gell/stream/stream');
const { array: arraySink } = require('gell/stream/sink');

const { TimePeriod } = require('gell-calendar/domain/timeperiod');
const standard = require('gell-calendar/standard');
const { assertTimestamp } = require('gell-calendar/ut/assert');

const scheduler = require('gell-schedule/scheduler/timeperiod');

const { add } = require('date-fns');

describe('timeperiod scheduler', function() {
    let $scheduler;

    beforeEach(function() {
    })

    describe('daily scheduler', function() {
        beforeEach(function() {
            const schedule_ = materialize.all({
                basis: new Date('10/24/2025 10:00')
            })
            // const { basis, duration, recurringDays, recurringEndDate, timePeriod='DAY' } = schedule_.snapshot();

            const year_ = new TimePeriod(standard.year);

            // WIP: this doesn't seem to work
            const calendar_ = year_.instance(new Date('01/01/2026'));
            // console.debug('#####', new Date(calendar_.snapshot().startTs));
            // console.debug('#####', new Date(calendar_.snapshot().endTs));
            // calendar_.set('startTs', new Date('01/01/2026').getTime());
            calendar_.set('endTs', new Date('01/01/2027').getTime());

            const day_ = new TimePeriod(standard.day);

            $scheduler = scheduler(schedule_, calendar_, day_);
        })
    
        it('generates correct number of sessions', async function() {
            const sessions_ = [];

            await stream($scheduler)
                .sink(arraySink(sessions_))
                ;

            assert.strictEqual(sessions_.length, 365);
        })

        it('generates the first session correctly', function() {
            const first_ = $scheduler.next().value;
            const first$ = first_.snapshot();

            assertTimestamp.same(first$.startTs, new Date('01/01/2026 10:00'));
        })
    })

    describe('week scheduler', function() {
        beforeEach(function() {
            const schedule_ = materialize.all({
                basis: new Date('10/24/2025 10:00')
            })
            // const { basis, duration, recurringDays, recurringEndDate, timePeriod='DAY' } = schedule_.snapshot();

            const year_ = new TimePeriod(standard.year);

            // WIP: this doesn't seem to work
            const calendar_ = year_.instance(new Date('01/01/2026'));
            // console.debug('#####', new Date(calendar_.snapshot().startTs));
            // console.debug('#####', new Date(calendar_.snapshot().endTs));
            // calendar_.set('startTs', new Date('01/01/2026').getTime());
            calendar_.set('endTs', new Date('01/01/2027').getTime());

            const week_ = new TimePeriod(standard.week);

            $scheduler = scheduler(schedule_, calendar_, week_);

        })
    
        it('generates the first session correctly', function() {
            const first_ = $scheduler.next().value;
            const first$ = first_.snapshot();

            assertTimestamp.same(first$.startTs, new Date('01/02/2026 10:00'));
            assertTimestamp.same($scheduler.next().value.snapshot().startTs, new Date('01/09/2026 10:00'));
        })

        it('generates the second session correctly', function() {
            $scheduler.next();
            const second_ = $scheduler.next().value;
            const second$ = second_.snapshot();

            assertTimestamp.same(second$.startTs, new Date('01/09/2026 10:00'));
        })
    })
})