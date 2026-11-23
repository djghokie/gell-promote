const assert = require('assert');

const runtime = require('../../../gell-runtime/mocha');

const bootstrap = require('./bootstrap');

const timeperiod = require('../../../gell-calendar/timeperiod/domain/timeperiod');
const instance = require('../../../gell-calendar/timeperiod/domain/instance');
const save = require('../../../gell-calendar/timeperiod/event/save');
const instanceSave = require('../../../gell-calendar/timeperiod/event/instance-save');
const timeperiodsSnapshot = require('../../../gell-calendar/timeperiod/snapshot/timeperiods');
const instancesSnapshot = require('../../../gell-calendar/timeperiod/snapshot/instances');

function runner(event) {
    return async function(params) {
        const $txn = this.store.write();

        const item_ = await event.action({ params, context: { $txn }, deps: this.deps });

        await $txn.return().value;

        return item_;
    }
}

const saveTimePeriod = runner(save);
const saveInstance = runner(instanceSave);

const WINTER = { name: 'Winter 2026-27', startTs: new Date('11/20/2026').getTime(), endTs: new Date('04/15/2027').getTime(), timeZone: 'America/Denver' };
const SUMMER = { name: 'Summer 2027', startTs: new Date('06/15/2027').getTime(), endTs: new Date('09/07/2027').getTime(), timeZone: 'America/Denver' };

const TYPE = `${bootstrap.NAMESPACE}::${timeperiod.TYPE}`;
const INSTANCE_TYPE = `${bootstrap.NAMESPACE}::${instance.TYPE}`;

describe('TIMEPERIOD', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    it('defaults type, description and status', function() {
        const timeperiod$ = this.deps.resolveSingle('types').instance(timeperiod.TYPE, { label: 'SEASON' }).snapshot();

        assert.strictEqual(timeperiod$.type, TYPE);
        assert.strictEqual(timeperiod$.description, '');
        assert.strictEqual(timeperiod$.status, 'ACTIVE');
    })

    it('normalizes labels', function() {
        assert.strictEqual(timeperiod.normalizeLabel(' pay period '), 'PAY_PERIOD');
    })

    describe('calendar.timeperiod.save', function() {
        it('creates TIMEPERIOD', async function() {
            const timeperiod_ = await saveTimePeriod.call(this, { label: 'season', description: 'operating seasons' });

            const timeperiod$ = await this.store.lookup({ type: TYPE, id: timeperiod_.snapshotAttribute('id') });

            assert.strictEqual(timeperiod$.label, 'SEASON');
            assert.strictEqual(timeperiod$.description, 'operating seasons');
        })

        it('updates TIMEPERIOD by id', async function() {
            const timeperiod_ = await saveTimePeriod.call(this, { label: 'SEMESTER' });
            const id = timeperiod_.snapshotAttribute('id');

            await saveTimePeriod.call(this, { id, label: 'TERM' });

            const timeperiod$ = await this.store.lookup({ type: TYPE, id });

            assert.strictEqual(timeperiod$.label, 'TERM');
        })

        it('rejects a standard label', async function() {
            await assert.rejects(saveTimePeriod.call(this, { label: 'week' }), /label is a standard time period \(label=WEEK\)/);
        })

        it('rejects a duplicate label', async function() {
            await saveTimePeriod.call(this, { label: 'QUARTER' });

            await assert.rejects(saveTimePeriod.call(this, { label: 'quarter' }), /time period already exists \(label=QUARTER\)/);
        })

        it('requires label', async function() {
            await assert.rejects(saveTimePeriod.call(this, { label: ' ' }), /label is required/);
        })
    })

    describe('calendar.timeperiod.instance.save', function() {
        let timePeriodId;

        beforeEach(async function() {
            const timeperiod_ = await saveTimePeriod.call(this, { label: `SEASON_${Date.now()}_${Math.random().toString(36).slice(2)}` });

            timePeriodId = timeperiod_.snapshotAttribute('id');
        })

        it('creates instance as a child of the TIMEPERIOD', async function() {
            const instance_ = await saveInstance.call(this, { timePeriodId, ...WINTER });

            const instance$ = await this.store.lookup({ type: INSTANCE_TYPE, id: instance_.snapshotAttribute('id') });

            assert.strictEqual(instance$.parentId, timePeriodId);
            assert.strictEqual(instance$.name, 'Winter 2026-27');
            assert.strictEqual(instance$.startTs, WINTER.startTs);
            assert.strictEqual(instance$.endTs, WINTER.endTs);
            assert.strictEqual(instance$.timeZone, 'America/Denver');
        })

        it('requires timeZone', async function() {
            const { timeZone, ...winter } = WINTER;

            await assert.rejects(saveInstance.call(this, { timePeriodId, ...winter }), /timeZone/);
        })

        it('rejects an invalid timeZone', async function() {
            await assert.rejects(
                saveInstance.call(this, { timePeriodId, ...WINTER, timeZone: 'Mountain' }),
                /timeZone is not a valid IANA time zone \(timeZone=Mountain\)/
            );
        })

        it('allows an instance without a name', async function() {
            const { name, ...winter } = WINTER;

            const instance_ = await saveInstance.call(this, { timePeriodId, ...winter });

            const instance$ = await this.store.lookup({ type: INSTANCE_TYPE, id: instance_.snapshotAttribute('id') });

            assert.strictEqual(instance$.name, '');
            assert.strictEqual(instance$.startTs, WINTER.startTs);
        })

        it('accepts date strings', async function() {
            const instance_ = await saveInstance.call(this, { timePeriodId, name: 'Winter', startTs: '11/20/2026', endTs: '04/15/2027', timeZone: 'America/Denver' });

            assert.strictEqual(instance_.snapshotAttribute('startTs'), WINTER.startTs);
        })

        it('allows gaps between instances', async function() {
            await saveInstance.call(this, { timePeriodId, ...WINTER });
            await saveInstance.call(this, { timePeriodId, ...SUMMER });

            const instances$ = await instancesSnapshot.effect({ params: { timePeriodId }, deps: this.deps });

            assert.deepStrictEqual(instances$.map(i$ => i$.name), ['Winter 2026-27', 'Summer 2027']);
        })

        it('rejects an overlapping instance', async function() {
            await saveInstance.call(this, { timePeriodId, ...WINTER });

            await assert.rejects(
                saveInstance.call(this, { timePeriodId, name: 'Early spring', startTs: new Date('04/01/2027').getTime(), endTs: new Date('05/01/2027').getTime(), timeZone: 'America/Denver' }),
                /instance overlaps another instance \(id=.+; name=Winter 2026-27\)/
            );
        })

        it('updates instance dates without overlapping itself', async function() {
            const instance_ = await saveInstance.call(this, { timePeriodId, ...WINTER });
            const id = instance_.snapshotAttribute('id');

            const endTs = new Date('04/30/2027').getTime();
            await saveInstance.call(this, { id, timePeriodId, ...WINTER, endTs });

            const instance$ = await this.store.lookup({ type: INSTANCE_TYPE, id });

            assert.strictEqual(instance$.endTs, endTs);
        })

        it('rejects start after end', async function() {
            await assert.rejects(saveInstance.call(this, { timePeriodId, ...WINTER, endTs: WINTER.startTs }), /startTs must be before endTs/);
        })

        it('rejects an invalid date', async function() {
            await assert.rejects(saveInstance.call(this, { timePeriodId, ...WINTER, startTs: 'not a date' }), /startTs is not a valid date/);
        })

        it('rejects an unknown TIMEPERIOD', async function() {
            await assert.rejects(saveInstance.call(this, { ...WINTER, timePeriodId: 'nope' }), /time period not found \(id=nope\)/);
        })
    })

    describe('calendar.timeperiods', function() {
        it('returns custom TIMEPERIODs sorted by label', async function() {
            await saveTimePeriod.call(this, { label: 'ZZ_LAST' });
            await saveTimePeriod.call(this, { label: 'AA_FIRST' });

            const labels = (await timeperiodsSnapshot.effect({ deps: this.deps })).map(tp$ => tp$.label);

            assert(labels.indexOf('AA_FIRST') < labels.indexOf('ZZ_LAST'));
        })

        it('api returns the same TIMEPERIODs as the effect', async function() {
            await saveTimePeriod.call(this, { label: 'SEASON' });

            const api$ = await timeperiodsSnapshot.api({ deps: this.deps });

            assert.deepStrictEqual(api$.map(tp$ => tp$.label), ['SEASON']);
        })
    })

    describe('without a types dependency', function() {
        beforeEach(function() {
            this.deps = this.deps.branch({ types: () => undefined });
        })

        it('saves TIMEPERIOD with the raw TYPE', async function() {
            const timeperiod_ = await saveTimePeriod.call(this, { label: 'SEASON' });

            const timeperiod$ = await this.store.lookup({ type: timeperiod.TYPE, id: timeperiod_.snapshotAttribute('id') });

            assert.strictEqual(timeperiod$.label, 'SEASON');
        })
    })
})
