const assert = require('assert');

const timeperiod = require('../domain/timeperiod');

/**
 * NOTE: creates when id is omitted, otherwise updates; label is normalized to UPPERCASE and must not
 * collide with a standard (HOUR, DAY, ...) or another custom TIMEPERIOD
 */
exports.__metadata = {
    name: 'calendar.timeperiod.save',
    description: 'creates or updates a custom TIMEPERIOD definition',
    triggers: {
        action: {
            params: {
                id: { type: 'string', optional: true },
                label: 'string',
                description: { type: 'string', optional: true },
            },
            transaction: 'NEW'
        }
    }
}

exports.action = async function({ params={}, context={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing action (name="calendar.timeperiod.save")');

    const { id, description } = params;
    const label = timeperiod.normalizeLabel(params.label);

    assert(label, 'label is required');
    assert(!timeperiod.STANDARD_LABELS.includes(label), `label is a standard time period (label=${label})`);

    const type = types ? types.name(timeperiod.TYPE) : timeperiod.TYPE;

    const timeperiods$ = await store.drain('sessions.activity.type', { type });
    const duplicate$ = timeperiods$.find(tp$ => tp$.label === label && tp$.id !== id);

    assert(!duplicate$, `time period already exists (label=${label})`);

    if (id) {
        var timeperiod$ = await store.lookup({ type, id });

        assert(timeperiod$, `time period not found (id=${id})`);
    }

    const timeperiod_ = types ? types.instance(timeperiod.TYPE, timeperiod$ || {}) : timeperiod.materialize(timeperiod$ || {});

    timeperiod_.set('label', label);
    if (description !== undefined) timeperiod_.set('description', description.trim());

    const { $txn } = context;

    $txn.next({ operation: 'put', item: timeperiod_ });

    return timeperiod_;
}
