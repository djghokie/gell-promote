const assert = require('assert');
const _ = require('lodash');

const tenant = require('gell-promote/gell-namespace/domain/tenant');
const active = require('gell-promote/gell-namespace/snapshot/active');

exports.__metadata = {
    name: 'namespace.tenants.active',
    description: 'returns all TENANTs',
    triggers: {
        effect: {
            params: {}
        },
        api: {
            params: {}
        }
    }
}

async function fetchTenants(deps) {
    const { types } = deps.resolve('types');

    const type = types.name(tenant.TYPE);

    return active.effect({
        params: {
            type
        },
        deps
    });
}

exports.effect = async function({ params={}, context={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing effect (name="tenants.all")');

    return fetchTenants(deps);
}

exports.api = async function({ params={}, deps }) {
    const { logger } = deps.resolve('logger');

    logger.info('executing api (name="tenants.all")');

    return fetchTenants(deps);
}
