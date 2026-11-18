/**
 * Named queries of gell-job; register with the project query registry (e.g. <prefix>-integration/dependencies/queries.js)
 */
exports['gell.job.executions'] = {
    name: 'gell.job.executions',
    description: 'query for the JOB EXECUTIONs of a job',
    parameters: {
        type: 'string',
        jobName: 'string'
    },

    filter: (items, { type, jobName }) => items.filter(s$ => s$.type === type && s$.jobName === jobName),

    query: ({ type, jobName }) => ({
        table: 'dynamodb.table.session',
        hash: type,
        options: {
            filters: [{ attr: 'jobName', eq: jobName }]
        }
    })
}
