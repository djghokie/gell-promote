const _ = require('lodash');

const message = require('../domain/message');
const { summary } = require('./messages');

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;

/**
 * Every email queued in the last `days` days, plus any still QUEUED however old, newest first (the outbox)
 *  - params.days (optional, default 30, at most 366): how far back to look
 *  - returns summaries without the message content (see ./message for one message in full)
 *  - uses the mail.messages.since query (../queries) - the application registers it on the session store
 *  - gell modules don't define application roles: register with gell-dispatch/util/restrict
 *
 * WIP: no paging - fine for the volume of a small business; page on initiatedTs if the outbox grows
 */
exports.__metadata = {
    name: 'mail.outbox',
    description: 'lists recent emails, and every email not sent yet',
    triggers: {
        effect: {
            params: {
                days: { type: 'number', optional: true },
            }
        },
        api: {
            params: {
                days: { type: 'number', optional: true },
            }
        }
    }
}

function windowDays(days) {
    const n = parseInt(days, 10);

    if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAYS;

    return Math.min(n, MAX_DAYS);
}

async function outbox({ days }, deps) {
    const { store } = deps.resolve('store');

    const since = Date.now() - windowDays(days) * DAY_MS;

    const [recent$, active$] = await Promise.all([
        store.drain('mail.messages.since', { since }),
        store.drain('sessions.active.type', { type: message.TYPE }),
    ]);

    return _.uniqBy([...recent$, ...active$], 'id')
        .sort((m1, m2) => (m2.initiatedTs || 0) - (m1.initiatedTs || 0))
        .map(summary);
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="mail.outbox")');

    return outbox(params, deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="mail.outbox")');

    return outbox(params, deps);
}
