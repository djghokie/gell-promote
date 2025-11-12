const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const runtime = require('gell-runtime/mocha');

const { TimePeriod } = require('gell-calendar/domain/timeperiod');
const standard = require('gell-calendar/standard');

const { assertTimestamp } = require('gell-schedule/ut/assert');

const schedule = require('../../../gell-calendar/event/schedule');

describe('timeperiod schedule', function() {
    before(runtime.beforeAll);

    beforeEach(function() {
        session_ = new State();
    })

    describe('week', function() {
        beforeEach(function() {
        })
    
        it('sets startTs correctly', async function() {
            const week_ = new TimePeriod(standard.week);
            const calendar_ = week_.instance(new Date('10/22/2025'));

            const target_ = await schedule.effect({
                params: {
                    start: new Date('10/07/2025 10:00').getTime()
                },
                context: {
                    target_: session_,
                    calendar_,
                    timePeriod_: week_
                },
                deps: this.deps
            });

            const target$ = target_.snapshot();

            assertTimestamp.same(target$.startTs, new Date('10/21/2025 10:00'));
        })

        it('allows Date for start parameter', async function() {
            const week_ = new TimePeriod(standard.week);
            const calendar_ = week_.instance(new Date('10/24/2025'));

            const target_ = await schedule.effect({
                params: {
                    start: new Date('10/07/2025 10:00')
                },
                context: {
                    target_: session_,
                    calendar_,
                    timePeriod_: week_
                },
                deps: this.deps
            });

            const target$ = target_.snapshot();

            assertTimestamp.same(target$.startTs, new Date('10/21/2025 10:00'));
        })

        it('allows string for start parameter', async function() {
            const week_ = new TimePeriod(standard.week);
            const calendar_ = week_.instance(new Date('10/24/2025'));

            const target_ = await schedule.effect({
                params: {
                    start: '10/08/2025 10:00'
                },
                context: {
                    target_: session_,
                    calendar_,
                    timePeriod_: week_
                },
                deps: this.deps
            });

            const target$ = target_.snapshot();

            assertTimestamp.same(target$.startTs, new Date('10/22/2025 10:00'));
        })
    })
})
