const assert = require('assert');
const _ = require('lodash');

const user = require('gell-web/domain/user');

const authorizer = require('../../../gell-web/middleware/authorizer');

describe('authorizer middleware', function() {
    let event, resume, resumed;

    beforeEach(function() {
        event = {
            __invocationSpec: {
                route: 'unittest.event'
            }
        };

        resume = function() {
            resumed = true;
        }
    })

    it('should fail if no caller present', async function() {
        return assert.rejects(z => authorizer(event, resume));
    })

    describe('any role', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec = {
                roles: '*'
            }
            event.caller = user.materialize({
                roles: ['admin']
            });
        })
    
        it('should fail if caller has no roles', async function() {
            event.caller.set('roles', []);

            return assert.rejects(z => authorizer(event, resume));
        })

        it('resumes chain', async function() {
            await authorizer(event, resume);

            assert(resumed);
        })
    })

    describe('specific role', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec = {
                roles: ['operator']
            }
            event.caller = user.materialize();
        })
    
        it('should fail if caller is different role', async function() {
            event.caller.set('roles', ['customer']);

            return assert.rejects(z => authorizer(event, resume));
        })

        it('resumes chain if single role matches', async function() {
            event.caller.set('roles', ['operator']);

            await authorizer(event, resume);

            assert(resumed);
        })

        it('resumes chain if at lease one role matches', async function() {
            event.caller.set('roles', ['admin', 'operator']);

            await authorizer(event, resume);

            assert(resumed);
        })
    })

    describe('multiple roles', function() {
        beforeEach(function() {
            event.__invocationSpec.triggerSpec = {
                roles: ['operator', 'admin']
            }
            event.caller = user.materialize();
        })
    
        it('should fail if caller is different role', async function() {
            event.caller.set('roles', ['customer']);

            return assert.rejects(z => authorizer(event, resume));
        })

        it('resumes chain if single role matches', async function() {
            event.caller.set('roles', ['admin']);

            await authorizer(event, resume);

            assert(resumed);
        })

        it('resumes chain if at lease one role matches', async function() {
            event.caller.set('roles', ['admin', 'support']);

            await authorizer(event, resume);

            assert(resumed);
        })
    })
})
