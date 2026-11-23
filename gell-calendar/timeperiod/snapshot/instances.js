const assert = require('assert');

const instance = require('../domain/instance');

exports.__metadata = {
    name: 'calendar.timeperiod.instances',
    description: 'returns the instances of a custom TIMEPERIOD, sorted by startTs',
    triggers: {
        effect: {
            params: { timePeriodId: 'string' }
        },
        api: {
            params: { timePeriodId: 'string' }
        }
    }
}

async function select(timePeriodId, deps) {
    const store = deps.resolveSingle('store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(instance.TYPE) : instance.TYPE;

    const instances$ = await store.drain('session.children', { type, parentId: timePeriodId });

    return instances$.sort((a$, b$) => a$.startTs - b$.startTs);
}

exports.effect = async function({ params={}, deps }) {
    deps.resolveSingle('logger').info('executing effect (name="calendar.timeperiod.instances")');

    const { timePeriodId } = params;

    return select(timePeriodId, deps);
}

exports.api = async function({ params={}, deps }) {
    deps.resolveSingle('logger').info('executing api (name="calendar.timeperiod.instances")');

    const { timePeriodId } = params;

    return select(timePeriodId, deps);
}
