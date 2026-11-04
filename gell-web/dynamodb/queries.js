const user = require('gell-web/domain/user');

/**
 * WIP: might not scale well for large number of users
 *  - could create "user" LS index (type, userId)
 */
exports['web.user.userId'] = {
    name: 'web.user.userId',
    description: 'query for the USER by userId',
    parameters: {
        userId: 'string',
        type: {
            type: 'string',
            optional: true
        },
        applicationId: 'string',
    },

    filter: (items, { userId, type=user.TYPE, applicationId }) => items.filter(s$ => {
        return s$.type === type && s$.userId === userId && s$.parentId === applicationId;
    }),

    query: ({ userId, applicationId, type=user.TYPE }) => ({
        table: 'dynamodb.table.session',
        hash: type,
        options: {
            index: 'children',
            eq: applicationId,
            filters: [
                { attr: 'userId', eq: userId },
            ]
        }
    })
}
