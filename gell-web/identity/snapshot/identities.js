const assert = require('assert');
const _ = require('lodash');

const identity = require('gell-web/identity/domain/identity');

exports.__metadata = {
    name: 'web.identities',
    description: 'returns all WEB#IDENTITY instances',
    triggers: {
        effect: {},
        api: {
            params: {}
        }
    }
}

const identities = [
    { id: 1, userEmail: 'user1@example.com', provider: 'email', providerId: 'user1@example.com', verified: true, created: '2025-10-01' },
    { id: 2, userEmail: 'user2@example.com', provider: 'google', providerId: 'google_123456', verified: true, created: '2025-10-02' },
    { id: 3, userEmail: 'user3@example.com', provider: 'github', providerId: 'github_789012', verified: true, created: '2025-10-03' },
    { id: 4, userEmail: 'user4@example.com', provider: 'email', providerId: 'user4@example.com', verified: false, created: '2025-10-04' },
    { id: 5, userEmail: 'user5@example.com', provider: 'twitter', providerId: 'twitter_345678', verified: true, created: '2025-10-05' },
    { id: 6, userEmail: 'user2@example.com', provider: 'email', providerId: 'user2@example.com', verified: true, created: '2025-10-02' },
];

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="web.identities")');

    throw new Error('NYI');
}

exports.api = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing api (name="web.identities")');

    return store.drain('sessions.activity.type', { type: identity.TYPE });
}
