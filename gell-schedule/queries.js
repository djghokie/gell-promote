const TABLE = 'dynamodb.table.session';

const packageQueries = require('gell-schedule/queries');

exports['scheduled.type.timerange'] = packageQueries['scheduled.type.timerange'];
exports['scheduled.type.future'] = packageQueries['scheduled.type.future'];

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

/**
 * Returns scheduled events for a given resource and time range
 *  - endTs is not required
 *  - can be filtered additionally by the associated event type
 * 
 * WIP: the published gell-schedule implementation had a bug with the time range filtering
 * 
 * WIP: this query is intended for INVITATION sessions
 *  - at least, the type query parameter refers to the type of the parent session
 *      - this would usually be the event the INVITATION is to
 */
exports['scheduled.resource.timerange'] = {
    name: 'scheduled.resource.timerange',
    description: 'query events for resource, scheduled within a time range',
    parameters: {
        resourceId: {
            type: 'string',
            description: 'id of the scheduled resource',
        },
        startTs: {
            type: 'timestamp',
            description: 'start of timestamp range (inclusive)'
        },
        endTs: {
            type: 'timestamp',
            description: 'end of timestamp range (inclusive)',
            optional: true,
        },
        type: {
            type: 'string',
            description: 'type of event',
            optional: true,
        },
    },
    filter: (items, { resourceId, type, startTs, endTs }) => {
        return items.filter(s$ => {
            if (s$.resourceId !== resourceId) return false;
            if (s$.startTs === undefined) return false;

            if (type && s$.event?.type !== type) return false;

            if (s$.startTs < startTs) return false;
            if (s$.startTs > endTs) return false;
    
            if (s$.recurringEndDate) return false;
            if (s$.status === 'CANCELED') return false;
            return true;
        });
    },
    query: ({ resourceId, startTs, endTs, type }) => {
        const q = {
            table: TABLE,
            hash: resourceId,
            options: {
                index: 'schedule_resource',
                filters: [{
                    attr: 'recurringEndDate',
                    exists: false,
                }, {
                    attr: 'status',
                    ne: 'CANCELED'
                }]
            }
        }
    
        if (endTs) q.options.between = [startTs, endTs];
        else q.options.gt = startTs;

        if (type) q.options.filters.push({
            attr: 'event.type',
            eq: trip.TYPE
        })

        return q;
    }
};