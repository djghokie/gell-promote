exports.__metadata = {
    name: 'gell.domain.jobs',
    description: 'returns all registered jobs',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

/**
 * NOTE: jobs is a map of job name to job module (<prefix>-admin/lib/dependencies/jobs.js; <prefix>-ut/bootstrap.js for tests)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, jobs } = deps.resolve('logger', 'jobs');

    logger.info('executing effect (name="gell.domain.jobs")');

    return Object.values(jobs)
        .map(({ __metadata: { name, description } }) => ({ name, description }))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.api = exports.effect;
