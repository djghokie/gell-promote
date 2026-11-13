const templates = require('./templates');

/**
 * The template a document of a name is signed from
 *  - params.name: e.g. 'hr.employee.agreement'
 *  - params.id (optional): the template chosen for the record; the default template otherwise
 *  - returns the template state (ACTIVE or not - see domain/template ready()), or undefined when there is none
 */
exports.__metadata = {
    name: 'document.template.choose',
    description: 'returns the template a document is signed from: the one chosen, or the default',
    triggers: {
        effect: {
            params: {
                name: 'string',
                id: { type: 'string', optional: true },
            }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="document.template.choose")');

    const templates_ = await templates.effect({ params: { name: params.name }, deps });

    if (params.id) return templates_.find(t_ => t_.snapshotAttribute('id') === params.id);

    return templates_.find(t_ => t_.snapshotAttribute('status') === 'ACTIVE' && t_.snapshotAttribute('isDefault'));
}
