const lookup = require('gell-session/snapshot/lookup');

const message = require('../domain/message');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sends a QUEUED MAIL#MESSAGE and records the outcome (one transaction of its own)
 *  - params.id: the message
 *  - a message that is not QUEUED (already SENT or FAILED, or not found) is skipped - a stream retry or a
 *    flush after the Lambda already sent it does not send it twice
 *  - SENT: sentTs, no longer active; ttl when the message has retainDays
 *  - a failed send counts an attempt and keeps the message QUEUED (and rethrows, so the stream retries it);
 *    after MAX_ATTEMPTS it is FAILED and no longer retried
 *  - attachments are read from their storage dependency and sent with the message (SendGrid attachments);
 *    a file that can't be read fails the send like any other error
 *  - returns the message State
 *
 * WIP: delivery is at least once - two deliveries of the same message at the same moment (stream and flush)
 *  can both send; flush only picks up messages queued a few minutes ago to make that unlikely
 */
exports.__metadata = {
    name: 'mail.message.deliver',
    description: 'sends a queued email and records whether it was sent',
    triggers: {
        effect: {
            params: {
                id: 'uuid',
            }
        }
    }
}

async function withAttachments(message$, attachments=[], deps) {
    if (!attachments.length) return message$;

    const files = await Promise.all(attachments.map(async ({ storage, key, filename, type }) => {
        const bytes = await deps.resolveSingle(storage).get(key);
        if (!bytes) throw new Error(`attachment not found (storage=${storage}; key=${key})`);

        return {
            content: Buffer.from(bytes).toString('base64'),
            filename,
            type: type || 'application/octet-stream',
            disposition: 'attachment',
        };
    }));

    return { ...message$, attachments: [...(message$.attachments || []), ...files] };
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store, mail } = deps.resolve('logger', 'store', 'mail');

    logger.info('executing effect (name="mail.message.deliver")');

    const message_ = await lookup.effect({
        params: { key: { type: message.TYPE, id: params.id } },
        context: { materialize: message.materialize },
        deps
    });

    if (!message_) {
        logger.warn(`email not found (id=${params.id})`);
        return undefined;
    }

    const { id, name, status, attempts=0, retainDays, message: message$, attachments } = message_.snapshotPartial(['id', 'name', 'status', 'attempts', 'retainDays', 'message', 'attachments']);

    if (status !== 'QUEUED') {
        logger.info(`email already delivered (id=${id}; status=${status})`);
        return message_;
    }

    const now = Date.now();
    let failure;

    try {
        await mail.send(await withAttachments(message$, attachments, deps));

        message_.set('status', 'SENT');
        message_.set('sentTs', now);
        message_.remove('activeTs');
        message_.remove('error');
        if (retainDays) message_.set('ttl', Math.floor((now + retainDays * DAY_MS) / 1000));

        logger.info(`sent email (name="${name}"; id=${id})`);
    } catch (e) {
        failure = e;

        message_.set('error', e.message);

        if (attempts + 1 >= message.MAX_ATTEMPTS) {
            message_.set('status', 'FAILED');
            message_.set('failedTs', now);
            message_.remove('activeTs');
        }

        logger.error(`email not sent (name="${name}"; id=${id}; attempt=${attempts + 1}; message=${e.message})`);
    }

    message_.set('attempts', attempts + 1);
    message_.set('updatedTs', now);

    const $txn = store.write();
    $txn.next({ operation: 'put', item: message_ });
    await $txn.return().value;

    if (failure && message_.snapshotAttribute('status') === 'QUEUED') throw failure;

    return message_;
}
