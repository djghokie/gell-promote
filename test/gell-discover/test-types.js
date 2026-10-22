const assert = require('assert');
const _ = require('lodash');

const session = require('gell-session/domain/session');

const { Types } = require('../../gell-discover/domain/types');

const type = require('./modules/type');

/**
 * WIP: taking another crack at a type registry with the following features
 *  - namespaced types
 *  - type extensions
 *  - stereotypes
 */
describe('types registy', function() {

    let types;

    beforeEach(function() {
        types = new Types();
    })

    describe.skip('registration', function() {
        beforeEach(function() {
        })
    
        it('works', function() {
            assert.fail('should fail');
        })
    })

    describe('names', function() {
        beforeEach(function() {
        })
    
        it('no definitions', function() {
            const names = types.names();

            assert.strictEqual(names.length, 0);
        })

        /**
         * WIP: test the actual name
         *  - what we test for might depend on how namespaced types are defined
         */
        it('single definition', function() {
            types.register(type.TYPE, type.model);

            const names = types.names();

            assert.strictEqual(names.length, 1);
        })

        /**
         * WIP: test the actual names
         *  - what we test for might depend on how namespaced types are defined
         */
        it('two definitions', function() {
            types.register(type.TYPE, type.model);
            types.register("GELLO", session.model);

            const names = types.names();

            assert.strictEqual(names.length, 2);
        })

        it.skip('returns stream', function() {
            const $names = types.names();

            assert($names);

            const name = $names.next().value;

            assert.strictEqual(name, 'UNITTEST#TYPE');
        })
    })

    describe('name', function() {
        beforeEach(function() {
        })
    
        it('with no namespace', function() {
            types.register(type.TYPE, type.model);

            const name = types.name(type.TYPE);

            assert.strictEqual(name, 'UNITTEST#TYPE');
        })

        it('with namespace', function() {
            types.register(type.TYPE, type.model, 'ECOSYSTEM');
            types.set('ECOSYSTEM', 'INCUBATOR');

            const name = types.name(type.TYPE);

            assert.strictEqual(name, 'INCUBATOR::UNITTEST#TYPE');
        })
    })

    /**
     * WIP: uses materialize to create type instances
     */
    describe('instances', function() {
        beforeEach(function() {
            types.set('ECOSYSTEM', 'INCUBATOR');
            types.set('APPLICATION', 'INCUBATOR:WEB');
        })
    
        it.skip('fails if no name provided', function() {
            assert.fail('should fail');
        })

        it.skip('throws exception if no type with name defined', function() {
            assert.fail('should fail');
        })

        it('simple instance', function() {
            types.register(type.TYPE, type.model);

            const instance_ = types.instance(type.TYPE);

            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.type, 'UNITTEST#TYPE');
            assert(!_.isUndefined(instance$.id));
        })

        it('instance without modeled type attribute', function() {
            types.register('BROWSER', session.model);

            const instance_ = types.instance('BROWSER');
            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.type, 'BROWSER');
            assert(!_.isUndefined(instance$.id));
        })

        it('materialized state', function() {
            types.register('foo', type.model);

            const instance_ = types.instance('foo', {
                id: '123'
            });

            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.id, '123');
        })

        it.skip('throws exception if namespace not defined', function() {
            assert.fail('should fail');
        })

        it('namespaced instance', function() {
            types.register(type.TYPE, type.model, 'ECOSYSTEM');

            const instance_ = types.instance('UNITTEST#TYPE');

            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.type, 'INCUBATOR::UNITTEST#TYPE');
            assert(!_.isUndefined(instance$.id));
        })

        it('namespaced materialized state', function() {
            types.register(type.TYPE, type.model, 'ECOSYSTEM');

            const instance_ = types.instance('UNITTEST#TYPE', { id: '456' });

            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.type, 'INCUBATOR::UNITTEST#TYPE');
            assert.strictEqual(instance$.id, '456');
        })

        it('alternative namespace instance', function() {
            types.register(type.TYPE, type.model, 'ECOSYSTEM');
            types.register('BROWSER', session.model, 'APPLICATION');

            const instance_ = types.instance('BROWSER');

            assert(instance_);
            
            const instance$ = instance_.snapshot();

            assert.strictEqual(instance$.type, 'INCUBATOR:WEB::BROWSER');
            assert(!_.isUndefined(instance$.id));
        })
    })

    describe('next stuff', function() {
        beforeEach(function() {
            types.register(type.TYPE, type.model, 'ECOSYSTEM');
            types.register('BROWSER', session.model, 'APPLICATION');
        })
    
        /**
         * WIP: test when namespaces change
         *  - this would represent two api calls from different applications
         *  - currently namespace ids are hardcoded
         *  - approaches
         *      1: pass arguments into instance method that identifies the namespace
         *      2: "generate" new types registry each time namespace changes
         *          - starting to lean in this direction
         *          - I like the idea of a "namespaced" API invocation
         *          - this relieves the actions/snapshots from having to correctly pass in contextual information about the call
         *          - perhaps you could still allow the event to override this somehow
         */
        it('changing namespaces', function() {
            const webTypes = types.clone();
            webTypes.set('ECOSYSTEM', 'INCUBATOR');
            webTypes.set('APPLICATION', 'INCUBATOR:WEB');

            const adminTypes = types.clone();
            adminTypes.set('APPLICATION', 'INCUBATOR:ADMIN');

            const webInstance_ = webTypes.instance('BROWSER');
            const web$ = webInstance_.snapshot();
            assert.strictEqual(web$.type, 'INCUBATOR:WEB::BROWSER');

            const adminInstance_ = adminTypes.instance('BROWSER');
            const admin$ = adminInstance_.snapshot();
            assert.strictEqual(admin$.type, 'INCUBATOR:ADMIN::BROWSER');
        })
    })

    /**
     * WIP: how to register stereotype extensions with types?
     *  - I haven't tried to do this before
     *  - going to test this out with a stereotype named "asset"
     *      - extension is going to be "vehicle"
     */
    describe('with stereotypes', function() {
        const asset = {
            types: {
                'BLUEHOUR#ASSET': {
                    extends: [session.model],
                    attributes: {
                        type: {
                            type: 'string',
                            default: 'BLUEHOUR#ASSET'
                        },
                        name: 'string'
                    }
                }
            },

            actions: {},
            snapshots: {},
        }

        function registerExtension(extension) {
            const stereotype = extension.extends;

            const names = Object.keys(stereotype.types);
            names.forEach(name => {
                const type = stereotype.types[name];
                const extendedType = extension.types[name];

                if (extendedType) {
                    var model = {
                        extends: [type], // WIP: multi inheritence NYI
        
                        // WIP: doing this instead of multi inheritence
                        attributes: extendedType.attributes
                    }
                } else {
                    var model = type;
                }

                types.register(extension.name, model, extension.namespace);
            })
        }

        beforeEach(function() {
            // console.debug('#####', compiler.compile(asset.type));

            const vehicle = {
                name: 'VEHICLE',
                /**
                 * WIP: do we want to continue the pattern of directly referencing the module
                 *  - we do this for types that extend other models
                 *  - alternative would be that the stereotype has to be registered somewhere
                 */
                extends: asset,

                namespace: 'TENANT',

                types: {
                    'BLUEHOUR#ASSET': {
                        attributes: {
                            make: 'string'
                        }
                    }
                }
            }

            registerExtension(vehicle);

            types.set('TENANT', 'INCUBATOR:PEAKSHUTTLE');
        })
    
        it('instance creation works', function() {
            const vehicle_ = types.instance('VEHICLE', { name: '2023 Ford Transit', make: 'Ford' });

            const vehicle$ = vehicle_.snapshot();

            assert.strictEqual(vehicle$.type, 'INCUBATOR:PEAKSHUTTLE::VEHICLE');
            assert.strictEqual(vehicle$.name, '2023 Ford Transit');
            assert.strictEqual(vehicle$.make, 'Ford');
        })

        it('second extension', function() {
            const property = {
                name: 'PROPERTY',
                extends: asset,
                namespace: 'TENANT',
                types: {
                    'BLUEHOUR#ASSET': {
                        attributes: {
                            streetAddress: 'string'
                        }
                    }
                }
            }

            registerExtension(property);

            const vehicle_ = types.instance('PROPERTY', { name: 'Aurora Lights', streetAddress: '123 Main St' });

            const vehicle$ = vehicle_.snapshot();

            assert.strictEqual(vehicle$.type, 'INCUBATOR:PEAKSHUTTLE::PROPERTY');
            assert.strictEqual(vehicle$.name, 'Aurora Lights');
            assert.strictEqual(vehicle$.streetAddress, '123 Main St');
        })
    })
})
