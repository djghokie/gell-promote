const message = require('../domain/message');
const deliver = require('./deliver');

const DEFAULT_AGE_MS = 5 * 60 * 1000;

/**
 * Delivers every MAIL#MESSAGE still QUEUED (the backstop for the mailer Lambda)
 *  - stream records only last 24 hours: covers the Lambda being down, records it gave up on, and messages
 *    queued before it was deployed
 *  - params.olderThanMs (optional, default 5 minutes): only messages queued at least this long ago, leaving
 *    fresh ones to the Lambda
 *  - returns { sent: [id], queued: [id] (failed this time, will be retried), failed: [id] (gave up) }
 *  - action: the same, for an operator (the outbox) - always with the default age, leaving fresh messages to the Lambda
 */
exports.__metadata = {
    name: 'mail.flush',
    description: 'sends every queued email the mailer has not sent',
    triggers: {
        effect: {
            params: {}
        },
        action: {
            params: {}
        }
    }
}

async function flush({ olderThanMs=DEFAULT_AGE_MS }, deps) {
    const { logger, store } = deps.resolve('logger', 'store');

    const before = Date.now() - olderThanMs;

    const queued$ = (await store.drain('sessions.active.type', { type: message.TYPE }))
        .filter(m$ => m$.status === 'QUEUED' && (m$.initiatedTs || 0) <= before);

    const result = { sent: [], queued: [], failed: [] };

    for (const m$ of queued$) {
        try {
            const message_ = await deliver.effect({ params: { id: m$.id }, deps });
            const status = message_ && message_.snapshotAttribute('status');

            if (status === 'FAILED') result.failed.push(m$.id);
            else result.sent.push(m$.id);
        } catch (e) {
            result.queued.push(m$.id);
        }
    }

    logger.info(`flushed queued email (found=${queued$.length}; sent=${result.sent.length}; retry=${result.queued.length}; failed=${result.failed.length})`);

    return result;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="mail.flush")');

    return flush(params, deps);
}

exports.action = async function({ deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing action (name="mail.flush")');

    return flush({}, deps);
}
