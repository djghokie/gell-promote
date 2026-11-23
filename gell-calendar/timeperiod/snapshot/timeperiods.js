const timeperiod = require('../domain/timeperiod');

exports.__metadata = {
    name: 'calendar.timeperiods',
    description: 'returns the custom TIMEPERIOD definitions, sorted by label',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

async function select(deps) {
    const store = deps.resolveSingle('store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    const type = types ? types.name(timeperiod.TYPE) : timeperiod.TYPE;

    const timeperiods$ = await store.drain('sessions.activity.type', { type });

    return timeperiods$.sort((a$, b$) => a$.label.localeCompare(b$.label));
}

exports.effect = async function({ params={}, deps }) {
    deps.resolveSingle('logger').info('executing effect (name="calendar.timeperiods")');

    return select(deps);
}

exports.api = async function({ params={}, deps }) {
    deps.resolveSingle('logger').info('executing api (name="calendar.timeperiods")');

    return select(deps);
}
