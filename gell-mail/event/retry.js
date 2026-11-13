const assert = require('assert');

const lookup = require('gell-session/snapshot/lookup');

const message = require('../domain/message');
const deliver = require('./deliver');

/**
 * Sends a QUEUED or FAILED MAIL#MESSAGE now (an operator retrying it from the outbox)
 *  - params.id: the message
 *  - FAILED: queued again with a fresh set of attempts (status QUEUED, attempts 0, active again), then sent;
 *    the update is a MODIFY on the session stream, so the mailer Lambda (INSERT only) doesn't also send it
 *  - QUEUED: sent now, as mail.flush would
 *  - a SENT message is not sent again
 *  - a failed send is recorded on the message (see ./deliver) and not rethrown - the caller sees the
 *    message's status and error
 *  - returns the message State
 *
 * WIP: retrying a QUEUED message while the mailer Lambda is sending it can send it twice (see ./deliver)
 */
exports.__metadata = {
    name: 'mail.message.retry',
    description: 'sends a queued or failed email now',
    triggers: {
        action: {
            params: {
                id: 'uuid',
            }
        }
    }
}

exports.action = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing action (name="mail.message.retry")');

    const message_ = await lookup.effect({
        params: { key: { type: message.TYPE, id: params.id } },
        context: { materialize: message.materialize },
        deps
    });

    assert(message_, `email not found (id=${params.id})`);

    const status = message_.snapshotAttribute('status');

    assert(status !== 'SENT', `email already sent (id=${params.id})`);

    if (status === 'FAILED') {
        const now = Date.now();

        message_.set('status', 'QUEUED');
        message_.set('attempts', 0);
        message_.set('activeTs', now);
        message_.set('updatedTs', now);
        message_.remove('failedTs');

        const $txn = store.write();
        $txn.next({ operation: 'put', item: message_ });
        await $txn.return().value;

        logger.info(`queued failed email again (id=${params.id})`);
    }

    try {
        return await deliver.effect({ params: { id: params.id }, deps });
    } catch (e) {
        // recorded on the message by deliver; it stays QUEUED for the mailer / mail.flush
        return lookup.effect({
            params: { key: { type: message.TYPE, id: params.id } },
            context: { materialize: message.materialize },
            deps
        });
    }
}
