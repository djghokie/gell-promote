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


/**
 * NOTE: MEMBER types are namespaced by the APPLICATION; parentId is the TENANT's id
 */
exports['web.member.userId'] = {
    name: 'web.member.userId',
    description: 'query for the MEMBER of a TENANT by userId',
    parameters: {
        type: 'string',
        parentId: 'string',
        userId: 'string',
    },

    filter: (items, { type, parentId, userId }) => items.filter(s$ => {
        return s$.type === type && s$.parentId === parentId && s$.userId === userId && !!s$.activeTs;
    }),

    query: ({ type, parentId, userId }) => ({
        table: 'dynamodb.table.session',
        hash: type,
        options: {
            index: 'children',
            eq: parentId,
            filters: [
                { attr: 'userId', eq: userId },
                { attr: 'activeTs', exists: true },
            ]
        }
    })
}

/**
 * WIP: scans every MEMBER of the APPLICATION (filtered by userId); could use a (type, userId) index
 */
exports['web.members.userId'] = {
    name: 'web.members.userId',
    description: 'query for the MEMBERs (one per TENANT) of a USER by userId',
    parameters: {
        type: 'string',
        userId: 'string',
    },

    filter: (items, { type, userId }) => items.filter(s$ => {
        return s$.type === type && s$.userId === userId && !!s$.activeTs;
    }),

    query: ({ type, userId }) => ({
        table: 'dynamodb.table.session',
        hash: type,
        options: {
            index: 'activity_type',
            reverse: true,
            filters: [
                { attr: 'userId', eq: userId },
                { attr: 'activeTs', exists: true },
            ]
        }
    })
}
