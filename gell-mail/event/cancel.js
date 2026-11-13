const lookup = require('gell-session/snapshot/lookup');

const message = require('../domain/message');

/**
 * Cancels a QUEUED MAIL#MESSAGE so it is never sent (an operator stopping it from the outbox)
 *  - params.id: the message
 *  - CANCELED, with canceledTs and canceledBy (the caller's userId); no longer active, so mail.flush skips it,
 *    and ./deliver skips anything not QUEUED - the mailer Lambda (INSERT only) doesn't see the update
 *  - only a QUEUED message can be canceled (400 otherwise) - a FAILED one is already never sent again
 *  - returns the message State
 *
 * WIP: the mailer Lambda usually sends a message within seconds, so this is for messages that are stuck
 *  (Lambda or SendGrid down); a cancel racing a delivery in flight can lose - the email is then SENT
 */
exports.__metadata = {
    name: 'mail.message.cancel',
    description: 'cancels a queued email so it is not sent',
    triggers: {
        action: {
            params: {
                id: 'uuid',
            },
            transaction: 'NEW'
        }
    }
}

function invalid(message) {
    const e = new Error(message);
    e.name = 'ParameterValidationError';
    e.status = 400;

    return e;
}

exports.action = async function({ params={}, context={}, caller, deps }) {
    const { logger } = deps.resolve('logger');
    const { $txn } = context;

    logger.info('executing action (name="mail.message.cancel")');

    const message_ = await lookup.effect({
        params: { key: { type: message.TYPE, id: params.id } },
        context: { materialize: message.materialize },
        deps
    });

    if (!message_) throw invalid(`email not found (id=${params.id})`);

    const status = message_.snapshotAttribute('status');

    if (status !== 'QUEUED') throw invalid(`only a queued email can be canceled (id=${params.id}; status=${status})`);

    const now = Date.now();

    message_.set('status', 'CANCELED');
    message_.set('canceledTs', now);
    message_.set('canceledBy', caller.snapshotAttribute('userId'));
    message_.set('updatedTs', now);
    message_.remove('activeTs');

    $txn.next({ operation: 'put', item: message_ });

    logger.info(`canceled email (id=${params.id})`);

    return message_;
}
