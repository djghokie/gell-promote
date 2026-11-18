const execution = require('../domain/execution');

exports.__metadata = {
    name: 'gell.job.executions',
    description: 'returns the JOB EXECUTIONs of a job (all JOB EXECUTIONs without a name), most recent first',
    triggers: {
        effect: {
            params: { name: { type: 'string', optional: true } }
        },
        api: {
            params: { name: { type: 'string', optional: true } }
        }
    }
}

/**
 * NOTE: all JOB EXECUTIONs come from gell-session's sessions.activity.type (activity_type index); sorted here because
 * its in-memory filter sorts oldest first
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, store } = deps.resolve('logger', 'store');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing effect (name="gell.job.executions")');

    const { name } = params;
    const type = types ? types.name(execution.TYPE) : execution.TYPE;

    const executions$ = name
        ? await store.drain('gell.job.executions', { type, jobName: name })
        : await store.drain('sessions.activity.type', { type });

    return executions$.sort((a$, b$) => (b$.initiatedTs || 0) - (a$.initiatedTs || 0));
}

exports.api = exports.effect;
