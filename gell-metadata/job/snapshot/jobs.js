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
function listJobs(deps) {
    const { jobs } = deps.resolve('jobs');

    return Object.values(jobs)
        .map(({ __metadata: { name, description } }) => ({ name, description }))
        .sort((a, b) => a.name.localeCompare(b.name))
        ;
}

exports.effect = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="gell.domain.jobs")');

    return listJobs(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="gell.domain.jobs")');

    return listJobs(deps);
}
