const message = require('./domain/message');

const TABLE = 'dynamodb.table.session';

/**
 * Named queries for gell-mail - applications register them on the session store
 */
exports['mail.messages.since'] = {
    name: 'mail.messages.since',
    description: 'returns the MAIL#MESSAGEs queued after a time, newest first',
    parameters: {
        since: 'timestamp',
    },
    filter: (items$, { since }) => {
        return items$
            .filter(m$ => m$.type === message.TYPE && (m$.initiatedTs || 0) > since)
            .sort((m1, m2) => (m2.initiatedTs || 0) - (m1.initiatedTs || 0));
    },
    query: ({ since }) => {
        return {
            table: TABLE,
            hash: message.TYPE,
            options: {
                index: 'activity_type',
                gt: since,
                reverse: true
            }
        }
    }
}
