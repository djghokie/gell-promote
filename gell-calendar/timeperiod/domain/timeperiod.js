const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const standard = require('gell-calendar/standard');

const TYPE = 'CALENDAR#TIMEPERIOD';

/**
 * TIMEPERIOD: a custom (defined) time period, e.g. SEASON or PAY_PERIOD
 *
 * NOTE: unlike the gell-calendar standard time periods (HOUR, DAY, ...), a custom TIMEPERIOD can't compute
 * its instances from a date; its instances are TIMEPERIOD_INSTANCE children (parentId) with dates that
 * someone enters, and gaps between instances are allowed
 *
 * WIP: no sortFormat/nameFormat yet; instances carry an explicit name
 */
const model = {
    name: TYPE,
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        label: 'string',
        description: {
            type: 'string',
            default: ''
        },
        status: {
            type: 'string',
            default: 'ACTIVE'
        },
    },
    workflow: {
        statuses: {
            ACTIVE: { description: 'available for new instances' },
        }
    }
}

const STANDARD_LABELS = Object.values(standard).map(def => def.label);

/**
 * Labels are UPPERCASE with underscores (SEASON, PAY_PERIOD)
 */
function normalizeLabel(label) {
    return String(label || '').trim().toUpperCase().replace(/\s+/g, '_');
}

module.exports = {
    TYPE,
    STANDARD_LABELS,
    model,
    normalizeLabel,
    materialize: timeperiod$ => javascript.materialize(timeperiod$, model)
}
