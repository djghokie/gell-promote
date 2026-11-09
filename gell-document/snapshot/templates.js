const template = require('../domain/template');

/**
 * The versions of a document template, newest first
 *  - params.name: the template name (e.g. 'hr.employee.agreement')
 *  - returns template states; applications expose them with their own api and roles
 */
exports.__metadata = {
    name: 'document.templates',
    description: 'lists the versions of a document template',
    triggers: {
        effect: {
            params: {
                name: 'string',
            }
        }
    }
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="document.templates")');

    // WIP: every name shares one type partition - add a name index if templates ever number more than a few dozen
    const templates$ = await store.drain('sessions.activity.type', { type: template.TYPE });

    return templates$
        .filter(t$ => t$.name === params.name)
        .sort((t1, t2) => (t2.version || 0) - (t1.version || 0))
        .map(template.materialize);
}
