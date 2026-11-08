const user = require('gell-web/domain/user');

exports['workflows.status'] = {
    name: 'workflows.status',
    description: 'query for all WORKFLOWs by status',
    parameters: {
        status: 'string',
        type: 'string',
    },

    filter: (items, { type, status }) => {
        const filtered = items.filter(s$ => s$.type === type && s$.status === status);
    
        filtered.sort((s1, s2) => s1.initiatedTs - s2.initiatedTs);
    
        return filtered;
    },
    
    query: ({ type, status }) => ({
        table: 'dynamodb.table.session',
        hash: type,
        options: {
            index: 'activity_type',
            filters: [{ attr: 'status', eq: status }],
            reverse: true
        }
    })
}
