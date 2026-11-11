const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const ecosystem = require('gell-promote/gell-namespace/domain/ecosystem');

const TYPE = 'GELL#JOB_EXECUTION';

/**
 * An execution (run) of a registered job (<prefix>-job), named by the job's __metadata.name
 *
 * NOTE: jobs are system wide, so a JOB EXECUTION belongs to the ECOSYSTEM (like a TENANT), not a TENANT
 */
const model = {
    name: TYPE,
    extends: [session.model],
    parent: ecosystem,
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        jobName: 'string',
        errorMessage: 'string',
        status: {
            type: 'string',
            default: 'PENDING'
        },
    },
    workflow: {
        statuses: {
            PENDING: { description: 'execution created; the job has not been run (executions started before jobs were run)' },
            RUNNING: { description: 'the job is running' },
            COMPLETED: { description: 'the job ran to completion (endedTs)' },
            FAILED: { description: 'the job threw (endedTs, errorMessage)' },
        }
    }
}

module.exports = {
    TYPE,
    model,
    materialize: execution$ => javascript.materialize(execution$, model)
}
