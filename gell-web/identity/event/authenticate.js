const assert = require('assert');
const _ = require('lodash');

exports.__metadata = {
    name: 'identity.authenticate',
    description: '"identity.authenticate" event',
    triggers: {
        effect: {},
    }
}

exports.effect = async function(event) {
    const { params={}, context={}, deps } = event;

	const { logger, $idm } = deps.resolve('logger', '$idm' );

    logger.info('executing effect (name="identity.authenticate")');

	const { userName: id, password } = params;

	logger.info(`authenticating identity (id==${id})`);

	const identity_ = await $idm.next({ id, password }).value;
	assert(identity_, 'invalid credentials');

	return identity_;
}
