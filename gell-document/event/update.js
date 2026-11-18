const { invalid } = require('../lib/errors');
const templates = require('../snapshot/templates');

/**
 * Renames, archives, restores or makes default a template
 *  - context.template_: the DOCUMENT#TEMPLATE; context.$txn
 *  - params.title (optional): the new name
 *  - params.status (optional): 'ARCHIVED' or 'ACTIVE'; an archived template is no longer offered and stops
 *    being the default (the service's copy is left alone - documents already signed don't depend on it)
 *  - params.isDefault (optional, true): makes an ACTIVE template the default for its name, in place of the
 *    current default
 *  - returns the template state, put in $txn (with the previous default, when it changed)
 */
exports.__metadata = {
    name: 'document.template.update',
    description: 'renames, archives, restores or makes default a document template',
    triggers: {
        effect: {
            params: {
                title: { type: 'string', optional: true },
                status: { type: 'string', optional: true },
                isDefault: { type: 'boolean', optional: true },
            },
            context: {
                template_: 'state',
                $txn: 'state'
            }
        }
    }
}

const STATUSES = ['ACTIVE', 'ARCHIVED'];

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');
    const { template_, $txn } = context;

    logger.info('executing effect (name="document.template.update")');

    const { status, isDefault } = params;
    const t$ = template_.snapshotPartial(['id', 'name', 'status']);

    if (params.title !== undefined) {
        const title = params.title.trim();
        if (!title) throw invalid('the template needs a name');

        template_.set('title', title);
    }

    if (status !== undefined) {
        if (!STATUSES.includes(status)) throw invalid(`unknown template status (status=${status})`);

        template_.set('status', status);

        if (status === 'ARCHIVED') {
            template_.set('isDefault', false);
            template_.set('archivedTs', Date.now());
        }
    }

    if (isDefault) {
        if ((status || t$.status) !== 'ACTIVE') throw invalid('an archived template cannot be the default');

        const others_ = (await templates.effect({ params: { name: t$.name }, deps }))
            .filter(o_ => o_.snapshotAttribute('id') !== t$.id && o_.snapshotAttribute('isDefault'));

        for (const other_ of others_) {
            other_.set('isDefault', false);
            $txn.next({ operation: 'put', item: other_ });
        }

        template_.set('isDefault', true);
    }

    // NOTE: one put of the whole template - DynamoDB rejects several operations on one item
    $txn.next({ operation: 'put', item: template_ });

    logger.info(`updated document template (id=${t$.id}; status=${template_.snapshotAttribute('status')}; isDefault=${!!template_.snapshotAttribute('isDefault')})`);

    return template_;
}
