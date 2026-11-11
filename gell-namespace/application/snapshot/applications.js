const assert = require('assert');
const _ = require('lodash');

const application = require('gell-promote/gell-namespace/domain/application');
const active = require('gell-promote/gell-namespace/snapshot/active');

exports.__metadata = {
    name: 'namespace.applications.active',
    description: 'returns all active APPLICATIONs',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

async function fetchApplications(deps) {
    const { types } = deps.resolve('types');

    const type = types.name(application.TYPE);

    return active.effect({
        params: {
            type
        },
        deps
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="applications.active")');

    return fetchApplications(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="applications.active")');

    return fetchApplications(deps);
}
