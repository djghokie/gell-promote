exports['sessions.bridged'] = {
    name: 'sessions.bridged',
    description: 'returns items associated through bridge index',
    parameters: {
        targetId: {
            type: 'uuid',
            description: 'associated item id',
        },
        type: {
			type: 'string',
			optional: true
		}
    },
    // WIP: implement
    filter: (items, { targetId, type }) => {
        return items.filter(s$ => {
            if (s$.targetId !== targetId) return false;

            if (type && s$.type !== type) return false;

            return true;
        });
    },
    query: ({ targetId, type }) => {
        const filters = [];

        return {
            table: 'dynamodb.table.session',
            hash: targetId,
            eq: type,
            options: {
                index: 'bridge',
                filters,
            }
        }
    }
};
