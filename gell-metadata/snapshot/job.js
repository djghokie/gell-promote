const assert = require('assert');

exports.__metadata = {
    name: 'gell.domain.job',
    description: 'returns a registered job by name',
    triggers: {
        effect: {
            params: { name: 'string' }
        },
        api: {
            params: { name: 'string' }
        }
    }
}

/**
 * NOTE: jobs is a map of job name to job module (<prefix>-admin/lib/dependencies/jobs.js; <prefix>-ut/bootstrap.js for tests)
 *  - dependencies: names the job declares in __metadata.dependencies
 *  - provides: names of the job specific dependencies the module exports (exports.dependencies)
 */
exports.effect = async function({ params={}, deps }) {
    const { logger, jobs } = deps.resolve('logger', 'jobs');

    logger.info('executing effect (name="gell.domain.job")');

    const { name } = params;

    assert(name, 'name is required');

    const job = jobs[name];

    if (!job) return;

    const { __metadata: { description, dependencies={} } } = job;

    return {
        name,
        description,
        dependencies: Object.keys(dependencies).sort(),
        provides: Object.keys(job.dependencies || {}).sort(),
    };
}

/**
 * NOTE: gell-http's api wrapper crashes on an empty result, so a missing job is reported as a 404 instead
 */
exports.api = async function({ params={}, deps }) {
    const job$ = await exports.effect({ params, deps });

    if (!job$) throw Object.assign(new Error(`job not found (name=${params.name})`), { status: 404 });

    return job$;
}
