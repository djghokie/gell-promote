const assert = require('assert');
const _ = require('lodash');

const message = require('../domain/message');
const reference = require('../domain/reference');

/**
 * Queues an email in the caller's transaction (the outbox) instead of sending it
 *  - params.message: the SendGrid message (personalizations, from, subject, content or template_id)
 *  - params.name: which email this is (e.g. 'hr.employee.invitation.email')
 *  - params.retainDays (optional): expire the message this many days after it is sent; otherwise it is kept with its parent
 *  - context.parent_: the record the email is about - a State, or a { type, id } key
 *  - params.attachments (optional): files to attach - [{ storage, key, filename, type }]: storage names the
 *    dependency the file is read from when the message is sent (get(key) -> bytes), e.g. gell-document's
 *    documentStorage.locate(key)
 *  - context.also_ (optional): more records it is about; one MAIL#REFERENCE is written for each
 *  - nothing is sent here: the message is delivered after the transaction commits (see ./deliver)
 */
exports.__metadata = {
    name: 'mail.message.queue',
    description: 'queues an email in the current transaction; it is sent once the transaction commits',
    triggers: {
        effect: {
            params: {
                name: 'string',
                message: 'object',
                attachments: { type: 'array', optional: true },
            },
            context: {
                parent_: 'state',
                $txn: 'state'
            }
        }
    }
}

function keyOf(record) {
    const { type, id } = _.isFunction(record.snapshotPartial) ? record.snapshotPartial(['type', 'id']) : record;

    assert(type && id, 'a record with type and id is required');

    return { type, id };
}

function addresses(recipients=[]) {
    return _.castArray(recipients).map(r => (_.isString(r) ? r : r && r.email)).filter(Boolean);
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="mail.message.queue")');

    const { name, message: message$, retainDays, attachments } = params;
    const { parent_, also_=[], $txn } = context;

    assert(message$, 'message is required');
    assert(parent_, 'parent_ is required');
    assert($txn, '$txn is required');

    const parent = keyOf(parent_);

    const personalizations = message$.personalizations || [];
    const to = _.uniq(personalizations.flatMap(p => addresses(p.to)));

    const message_ = message.materialize({
        parentId: parent.id,
        parentType: parent.type,
        name,
        message: message$,
        to,
        subject: message$.subject || message$.template_id,
        ...(attachments && attachments.length ? { attachments: attachments.map(a => _.pick(a, ['storage', 'key', 'filename', 'type'])) } : {}),
        attempts: 0,
        retainDays,
        activeTs: Date.now(),
        status: 'QUEUED',
    });

    $txn.next({ operation: 'put', item: message_ });

    const messageId = message_.snapshotAttribute('id');

    _.uniqBy(also_.map(keyOf), 'id')
        .filter(key => key.id !== parent.id)
        .forEach(key => {
            $txn.next({
                operation: 'put',
                item: reference.materialize({ parentId: key.id, parentType: key.type, messageId })
            });
        });

    logger.info(`queued email (name="${name}"; id=${messageId}; parentType=${parent.type}; parentId=${parent.id}; to=${to.join(',')})`);

    return message_;
}
