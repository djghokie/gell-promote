const template = require('../domain/template');
const templates = require('../snapshot/templates');

/**
 * Saves the DRAFT version of a document template, starting the next version if there is none
 *  - params: { name, title, body }
 *  - context.$txn: the caller's transaction
 */
exports.__metadata = {
    name: 'document.template.save',
    description: 'saves the DRAFT version of a document template, starting the next version if there is none',
    triggers: {
        effect: {
            params: {
                name: 'string',
                title: 'string',
                body: 'string',
            },
            context: {
                $txn: 'state'
            }
        }
    }
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');
    const { $txn } = context;

    logger.info('executing effect (name="document.template.save")');

    const { name, body } = params;
    const title = params.title.trim();

    const templates_ = await templates.effect({ params: { name }, deps });

    const draft_ = templates_.find(t_ => t_.snapshotAttribute('status') === 'DRAFT');

    if (draft_) {
        draft_.set('title', title);
        draft_.set('body', body);

        // NOTE: one put of the whole template - DynamoDB rejects several operations on one item
        $txn.next({ operation: 'put', item: draft_ });

        return draft_;
    }

    const latest = templates_.length > 0 ? templates_[0].snapshotAttribute('version') : 0;

    const created_ = template.materialize({
        name,
        version: latest + 1,
        title,
        body,
        status: 'DRAFT',
    });

    $txn.next({ operation: 'put', item: created_ });

    return created_;
}
