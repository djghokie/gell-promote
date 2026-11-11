const assert = require('assert');

const execution = require('../../gell-job/domain/execution');
const executionsSnapshot = require('../../gell-job/snapshot/executions');
const executionSnapshot = require('../../gell-job/snapshot/execution');

const runtime = require('gell-runtime/mocha');
const ecosystem = require('../../gell-namespace/domain/ecosystem');

const bootstrap = require('./bootstrap');

const { NAMESPACE } = bootstrap;
const TYPE = `${NAMESPACE}::${execution.TYPE}`;

/**
 * NOTE: stub jobs, so starting a job doesn't run a real job module
 */
function registerJob(name, run=async () => {}, more={}) {
    const jobs = this.deps.resolveSingle('jobs');

    jobs[name] = { __metadata: { name }, run, ...more };

    return jobs[name];
}

function startJob(name) {
    return this.dispatch({
        route: 'gell.job.start#action',
        caller: this.operator_,
        params: name ? { name } : {},
        // NOTE: the admin bus puts the ECOSYSTEM on every action's context (namespace middleware)
        context: { ecosystem_: ecosystem.materialize({ id: NAMESPACE }) },
        deps: this.deps
    });
}

function lookupStored(execution_) {
    return this.store.lookup({ type: TYPE, id: execution_.get('id') });
}

describe('gell-job', function() {
    before(runtime.beforeAll);
    beforeEach(bootstrap.beforeEach);

    beforeEach(function() {
        registerJob.call(this, 'test.job');
        registerJob.call(this, 'test.other');
    })

    describe('gell.job.start', function() {
        it('runs the job', async function() {
            let ran = false;
            registerJob.call(this, 'test.job', async () => { ran = true; });

            await startJob.call(this, 'test.job');

            assert.strictEqual(ran, true);
        })

        it('runs the job with params, declared dependencies and deps', async function() {
            let args;
            registerJob.call(this, 'test.job', async (...a) => { args = a; }, {
                __metadata: { name: 'test.job', dependencies: { greeting: {} } },
                dependencies: { greeting: () => 'hello' },
            });

            await startJob.call(this, 'test.job');

            const [params, resolved, deps] = args;

            assert.deepStrictEqual(params, {});
            assert.strictEqual(resolved.greeting, 'hello');
            assert.strictEqual(deps.resolveSingle('greeting'), 'hello');
            assert(deps.resolveSingle('store'), 'missing store');
        })

        it('returns COMPLETED JOB EXECUTION', async function() {
            const execution_ = await startJob.call(this, 'test.job');

            assert(execution_.get('id'), 'missing id');
            assert.strictEqual(execution_.snapshotAttribute('jobName'), 'test.job');
            assert.strictEqual(execution_.snapshotAttribute('status'), 'COMPLETED');
        })

        it('saves COMPLETED JOB EXECUTION under the ECOSYSTEM', async function() {
            const execution_ = await startJob.call(this, 'test.job');

            const execution$ = await lookupStored.call(this, execution_);

            assert.strictEqual(execution$.jobName, 'test.job');
            assert.strictEqual(execution$.status, 'COMPLETED');
            assert.strictEqual(execution$.parentId, NAMESPACE);
            assert(execution$.initiatedTs, 'missing initiatedTs');
            assert(execution$.endedTs >= execution$.initiatedTs, 'missing endedTs');
        })

        it('saves RUNNING JOB EXECUTION before the job runs', async function() {
            let during$;
            registerJob.call(this, 'test.job', async () => {
                const executions$ = await this.store.drain('gell.job.executions', { type: TYPE, jobName: 'test.job' });

                // NOTE: copied: the in-memory store returns its item, which the later session.end modifies in place
                during$ = { ...executions$[0] };
            });

            await startJob.call(this, 'test.job');

            assert.strictEqual(during$.status, 'RUNNING');
            assert(!during$.endedTs, 'unexpected endedTs');
        })

        it('saves FAILED JOB EXECUTION when the job throws', async function() {
            registerJob.call(this, 'test.job', async () => { throw new Error('boom'); });

            const execution_ = await startJob.call(this, 'test.job');

            assert.strictEqual(execution_.snapshotAttribute('status'), 'FAILED');

            const execution$ = await lookupStored.call(this, execution_);

            assert.strictEqual(execution$.status, 'FAILED');
            assert.strictEqual(execution$.errorMessage, 'boom');
            assert(execution$.endedTs, 'missing endedTs');
        })

        it('creates a new JOB EXECUTION per start', async function() {
            const first_ = await startJob.call(this, 'test.job');
            const second_ = await startJob.call(this, 'test.job');

            assert.notStrictEqual(first_.get('id'), second_.get('id'));
        })

        it('rejects an unknown job', async function() {
            await assert.rejects(startJob.call(this, 'report.missing'), /job not found/);
        })

        it('requires name', async function() {
            await assert.rejects(startJob.call(this), /name/);
        })
    })

    describe('gell.job.executions', function() {
        function listExecutions(name) {
            return executionsSnapshot.api({ params: name ? { name } : {}, deps: this.deps });
        }

        it('returns the JOB EXECUTIONs of a job', async function() {
            const first_ = await startJob.call(this, 'test.job');
            const second_ = await startJob.call(this, 'test.job');

            const executions$ = await listExecutions.call(this, 'test.job');

            assert.deepStrictEqual(executions$.map(e$ => e$.id).sort(), [first_.get('id'), second_.get('id')].sort());
            executions$.forEach(e$ => assert.strictEqual(e$.status, 'COMPLETED'));
        })

        it('excludes other jobs', async function() {
            await startJob.call(this, 'test.job');
            const other_ = await startJob.call(this, 'test.other');

            const executions$ = await listExecutions.call(this, 'test.other');

            assert.deepStrictEqual(executions$.map(e$ => e$.id), [other_.get('id')]);
        })

        it('sorts most recent first', async function() {
            const types_ = this.deps.resolveSingle('types');

            const older_ = types_.instance(execution.TYPE, { jobName: 'test.job', initiatedTs: 1000 });
            const newer_ = types_.instance(execution.TYPE, { jobName: 'test.job', initiatedTs: 2000 });

            await this.store.save(older_);
            await this.store.save(newer_);

            const executions$ = await listExecutions.call(this, 'test.job');

            assert.deepStrictEqual(executions$.map(e$ => e$.id), [newer_.get('id'), older_.get('id')]);
        })

        it('returns nothing for a job never started', async function() {
            const executions$ = await listExecutions.call(this, 'test.job');

            assert.deepStrictEqual(executions$, []);
        })

        it('returns all JOB EXECUTIONs without a name', async function() {
            const first_ = await startJob.call(this, 'test.job');
            const second_ = await startJob.call(this, 'test.other');

            const executions$ = await listExecutions.call(this);

            assert.deepStrictEqual(executions$.map(e$ => e$.id).sort(), [first_.get('id'), second_.get('id')].sort());
        })

        it('sorts all JOB EXECUTIONs most recent first', async function() {
            const types_ = this.deps.resolveSingle('types');

            const older_ = types_.instance(execution.TYPE, { jobName: 'test.job', initiatedTs: 1000 });
            const newer_ = types_.instance(execution.TYPE, { jobName: 'test.other', initiatedTs: 2000 });

            await this.store.save(older_);
            await this.store.save(newer_);

            const executions$ = await listExecutions.call(this);

            assert.deepStrictEqual(executions$.map(e$ => e$.id), [newer_.get('id'), older_.get('id')]);
        })
    })

    describe('gell.job.execution', function() {
        function lookupExecution(id) {
            return executionSnapshot.api({ params: { id }, deps: this.deps });
        }

        it('returns JOB EXECUTION by id', async function() {
            const execution_ = await startJob.call(this, 'test.job');

            const execution$ = await lookupExecution.call(this, execution_.get('id'));

            assert.strictEqual(execution$.id, execution_.get('id'));
            assert.strictEqual(execution$.jobName, 'test.job');
            assert.strictEqual(execution$.status, 'COMPLETED');
        })

        it('reports unknown JOB EXECUTION as 404', async function() {
            await assert.rejects(lookupExecution.call(this, '00000000-0000-0000-0000-000000000000'), { status: 404 });
        })
    })
})
