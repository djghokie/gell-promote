const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = 'CALENDAR#TIMEPERIOD#INSTANCE';

/**
 * TIMEPERIOD_INSTANCE: one dated span of a custom TIMEPERIOD (parentId), e.g. "Winter 2026-27"
 *
 * NOTE: endTs is exclusive, matching the gell-calendar Calendar instances
 * NOTE: timeZone is an IANA name (America/Denver); startTs/endTs are still UTC timestamps, timeZone records
 * the zone the dates were entered in and should be displayed in
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        name: {
            type: 'string',
            default: ''
        },
        startTs: 'timestamp',
        endTs: 'timestamp',
        timeZone: 'string',
        status: {
            type: 'string',
            default: 'ACTIVE'
        },
    },
    workflow: {
        statuses: {
            ACTIVE: { description: 'a scheduled span of its TIMEPERIOD' },
        }
    }
}

function overlaps(a$, b$) {
    return a$.startTs < b$.endTs && b$.startTs < a$.endTs;
}

function isTimeZone(timeZone) {
    if (!timeZone || typeof timeZone !== 'string') return false;

    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    TYPE,
    model,
    overlaps,
    isTimeZone,
    materialize: instance$ => javascript.materialize(instance$, model)
}
