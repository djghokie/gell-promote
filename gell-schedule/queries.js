const TABLE = 'dynamodb.table.session';

/**
 * WIP: could probably just merge this with scheduled.type.timerange
 *  - make startTs and endTs optional
 *  - only problem is that timerange query filters out CANCELED sessions
 */
exports['scheduled.type'] = {
    name: 'scheduled.type',
    description: 'query for scheduled sessions by type',
    parameters: {
        type: {
            type: 'string',
            description: 'type of event',  // required to avoid scan
        },
    },
    filter: (items, { type }) => {
        return items.filter(s$ => {
            if (s$.startTs === undefined) return false;

            if (type && s$.type !== type) return false;

            return true;
        });
    },
    query: ({ type }) => {
        return {
            table: TABLE,
            hash: type,
            options: {
                index: 'schedule_type'
            }
        }
    }
};
