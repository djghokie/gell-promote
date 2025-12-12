// const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = "SESSION#METRIC";

/**
 * WIP: should this be called "metrics"?
 *  - multiple values per subject/timeperiod combination
 */
const model = {
    // extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
    },

    subject: {
        type: 'uuid',
        description: 'id of the session the metric values apply to'
    },
    timePeriod: {
        type: 'string',
        description: 'represents the time period the metric values apply to; typically a formatted date string but could also be custom like "WINTER 2025"'
    },
    subjectType: {
        type: 'string',
        description: 'tyoe of the subject session'
    },
    timePeriodDef: {
        type: 'string',
        description: 'refers to the time period spec, such as "DAY" or "YEAR"'
    },
}

module.exports = {
    TYPE,
    model,
    materialize: session$ => javascript.materialize(session$, model)
}
