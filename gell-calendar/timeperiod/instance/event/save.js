const assert = require('assert');
const _ = require('lodash');

const timeperiod = require('../../domain/timeperiod');
const instance = require('../../domain/instance');

/**
 * NOTE: creates when id is omitted, otherwise updates; name is optional (blank clears it); startTs/endTs accept a timestamp or a date string
 * NOTE: timeZone (IANA, e.g. America/Denver) is recorded as-is; the caller converts the wall-clock dates it
 * entered in that zone to startTs/endTs
 *
 * WIP: instances of the same TIMEPERIOD may not overlap (gaps are fine); not confirmed that overlap is never
 * wanted
 */
exports.__metadata = {
    name: 'calendar.timeperiod.instance.save',
    description: 'creates or updates a dated instance of a custom TIMEPERIOD',
    triggers: {
        action: {
            params: {
                id: { type: 'string', optional: true },
                timePeriodId: 'string',
                name: { type: 'string', optional: true },
                // NOTE: checked by the app's dispatch bus (gell-promote/gell-dispatch/middleware/arguments)
                startTs: {
                    type: 'timestamp',
                    validate: startTs => Number.isFinite(parseTs(startTs)) || `startTs is not a valid date (startTs=${startTs})`,
                },
                endTs: {
                    type: 'timestamp',
                    validate: (endTs, { startTs }) => {
                        const end = parseTs(endTs);

                        if (!Number.isFinite(end)) return `endTs is not a valid date (endTs=${endTs})`;

                        // NOTE: an invalid startTs is reported by its own validate
                        return !Number.isFinite(parseTs(startTs)) || parseTs(startTs) < end || 'startTs must be before endTs';
                    },
                },
                timeZone: {
                    type: 'string',
                    validate: timeZone => instance.isTimeZone(timeZone) || `timeZone is not a valid IANA time zone (timeZone=${timeZone})`,
                },
            },
            transaction: 'NEW'
        }
    }
}

/**
 * A timestamp or date string as epoch milliseconds (NaN when it is not a date)
 */
function parseTs(value) {
    return _.isNumber(value) ? value : new Date(value).getTime();
}

function toTs(value, name) {
    const ts = parseTs(value);

    assert(Number.isFinite(ts), `${name} is not a valid date (${name}=${value})`);

    return ts;
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing action (name="calendar.timeperiod.instance.save")');

    const { id, timePeriodId } = params;
    const name = (params.name || '').trim();

    // NOTE: a bus with gell-promote's arguments middleware runs these checks first (params' validate); the asserts
    // still guard direct calls (and buses without it)
    assert(instance.isTimeZone(params.timeZone), `timeZone is not a valid IANA time zone (timeZone=${params.timeZone})`);

    const startTs = toTs(params.startTs, 'startTs');
    const endTs = toTs(params.endTs, 'endTs');

    assert(startTs < endTs, 'startTs must be before endTs');

    const timeperiodType = types ? types.name(timeperiod.TYPE) : timeperiod.TYPE;
    const instanceType = types ? types.name(instance.TYPE) : instance.TYPE;

    const timeperiod$ = await store.lookup({ type: timeperiodType, id: timePeriodId });

    assert(timeperiod$, `time period not found (id=${timePeriodId})`);

    const siblings$ = await store.drain('session.children', { type: instanceType, parentId: timePeriodId });
    const overlap$ = siblings$.find(s$ => s$.id !== id && instance.overlaps(s$, { startTs, endTs }));

    assert(!overlap$, `instance overlaps another instance (id=${overlap$ && overlap$.id}; name=${overlap$ && overlap$.name})`);

    if (id) {
        var instance$ = await store.lookup({ type: instanceType, id });

        assert(instance$ && instance$.parentId === timePeriodId, `time period instance not found (id=${id})`);
    }

    const instance_ = types ? types.instance(instance.TYPE, instance$ || { parentId: timePeriodId }) : instance.materialize(instance$ || { parentId: timePeriodId });

    if (params.name !== undefined) instance_.set('name', name);
    instance_.set('startTs', startTs);
    instance_.set('endTs', endTs);
    instance_.set('timeZone', params.timeZone);

    const { $txn } = context;

    $txn.next({ operation: 'put', item: instance_ });

    return instance_;
}
