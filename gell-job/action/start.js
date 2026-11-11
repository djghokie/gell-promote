const assert = require('assert');

const { createInitiate } = require('gell-promote/gell-session/util/event');

const end = require('gell-session/event/end');
const update = require('gell-session/event/update');

const execution = require('../domain/execution');

/**
 * NOTE: no transaction trigger option: the JOB EXECUTION is committed (RUNNING) before the job runs, and its outcome
 * (COMPLETED/FAILED) in a second transaction, so a failing job still leaves a FAILED JOB EXECUTION
 */
const __metadata = {
    name: 'gell.job.start',
    description: 'starts a JOB EXECUTION of a registered job and runs the job',
    triggers: {
        action: {
            params: {
                name: 'string',
            },
        }
    },
}

exports.__metadata = __metadata;

const initiate = createInitiate(__metadata, execution);

/**
 * Runs a job module the way the CLI runner does (gell-job/new/runner): a child logger and the job's own
 * dependencies (exports.dependencies) are branched into deps, and the dependencies the job declares
 * (__metadata.dependencies) are resolved for run's second argument
 *
 * WIP: params are always {} (cli.js passes {} too)
 */
async function runJob(job, params, deps) {
    const { __metadata: { name, dependencies: declared={} }, dependencies } = job;

    const logger = deps.resolveSingle('logger');

    const jobLogger = logger.child();
    jobLogger.defaultMeta = { sequence: name };

    const jobDeps = deps.branch(Object.assign({ logger: jobLogger }, dependencies));

    const resolved = jobDeps.resolve(...Object.keys(declared));

    logger.info(`executing job (name="${name}")`);

    return job.run(params, resolved, jobDeps);
}

async function commit(deps, fn) {
    const store = deps.resolveSingle('store');

    const $txn = store.write();

    const result = await fn($txn);

    await $txn.return().value;

    return result;
}

/**
 * NOTE: jobs is a map of job name to job module (<prefix>-admin/lib/dependencies/jobs.js; <prefix>-ut/bootstrap.js for tests)
 * WIP: the job runs inside the request, so a long running job holds the request open (and is subject to its timeout)
 * WIP: job output isn't captured (report jobs write to stdout, which goes to the server log)
 * WIP: the initiating user isn't recorded (createInitiate doesn't pass session.initiate's initiator_)
 */
exports.action = async function({ params={}, context={}, deps }) {
    const { ecosystem_ } = context;
    assert(ecosystem_, 'ecosystem_ is required (the admin bus puts it on the context)');

    const { logger, jobs } = deps.resolve('logger', 'jobs');
    const types = deps.resolveSingle({ name: 'types', optional: true });

    logger.info('executing action (name="gell.job.start")');

    const { name } = params;

    assert(name, 'name is required');

    const job = jobs[name];
    assert(job, `job not found (name=${name})`);

    const running$ = { jobName: name, status: 'RUNNING' };
    const running_ = types ? types.instance(execution.TYPE, running$) : execution.materialize(running$);

    const execution_ = await commit(deps, $txn => initiate.effect({
        params: running_.snapshot(),
        context: {
            // NOTE: same ECOSYSTEM parent as namespace.tenant.create
            parent_: ecosystem_,
            $txn
        },
        deps
    }));

    try {
        await runJob(job, {}, deps);
    } catch (e) {
        logger.error(`job failed (name="${name}"; executionId=${execution_.get('id')}; reason=${e.message})`);

        // NOTE: separate transactions: DynamoDB rejects a transaction with more than one operation on the same item
        await commit(deps, $txn => update.effect({ params: { attribute: 'errorMessage', value: e.message || String(e) }, context: { session_: execution_, $txn }, deps }));
        await commit(deps, $txn => end.effect({ params: { status: 'FAILED' }, context: { session_: execution_, $txn }, deps }));

        return execution_;
    }

    logger.info(`job completed (name="${name}"; executionId=${execution_.get('id')})`);

    await commit(deps, $txn => end.effect({ params: { status: 'COMPLETED' }, context: { session_: execution_, $txn }, deps }));

    return execution_;
}
