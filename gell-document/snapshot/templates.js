const template = require('../domain/template');

/**
 * The templates for documents of a name: ACTIVE before ARCHIVED, the default first, then by title
 *  - params.name (optional): e.g. 'hr.employee.agreement'; every template when left out
 *  - returns template states; applications expose them with their own api and roles
 */
exports.__metadata = {
    name: 'document.templates',
    description: 'lists the templates for documents of a name',
    triggers: {
        effect: {
            params: {
                name: { type: 'string', optional: true },
            }
        }
    }
}

function rank(t$) {
    return (t$.status === 'ACTIVE' ? 0 : 2) + (t$.isDefault ? 0 : 1);
}

exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');

    logger.info('executing effect (name="document.templates")');

    // WIP: every name shares one type partition - add a name index if templates ever number more than a few dozen
    const templates$ = await store.drain('sessions.activity.type', { type: template.TYPE });

    return templates$
        .filter(t$ => !params.name || t$.name === params.name)
        .sort((t1, t2) => rank(t1) - rank(t2) || String(t1.title || '').localeCompare(String(t2.title || '')))
        .map(template.materialize);
}
