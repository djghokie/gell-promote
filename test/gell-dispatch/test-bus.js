const assert = require('assert');
const _ = require('lodash');

const { init } = require('gell/future');
const runtime = require('gell-runtime/mocha');

const bus = require('../../gell-dispatch/bus');
const resolver = require('gell-session/dispatch/resolver');

const attributeMiddleware = require('../../gell-dispatch/middleware/attributes');
const argumentMiddleware = require('../../gell-dispatch/middleware/arguments');
const transactionMiddleware = require('../../gell-aws-dynamodb/middleware/transaction');

const MockStore = require('gell-aws-dynamodb/mock/store');

const EVENTS = {
    nometadata: {
        action: z => 'gello!'
    },
    simple: {
        __metadata: {
            triggers: {
                action: {}
            }
        },

        action: async event => 'success'
    },
    paramterized: {
        __metadata: {
            triggers: {
                effect: {
                    params: {
                        message: 'string'
                    },
                    context: {
                        session$: 'complex'
                    }
                },
                action: {
                    params: {
                        message: 'string',
                        count: {
                            type: 'number',
                            optional: true
                        },
                    },
                    context: {
                        user$: {
                            type: 'complex',
                            optional: true
                        }
                    }
                }
            }
        },
    
        effect: z => {},
        action: z => {}
    }
}

describe('event bus', function() {
    let events, $resolver, $bus;

    let store;

    before(runtime.beforeAll);

    beforeEach(function() {
        store = new MockStore();
	    // store.writeOptions.namedOperations = sessionOperations;  // NOTE: named operation not working for some reaons

        this.deps.define('store', store);

        this.store = store;
    })

    beforeEach(function() {
        events = { ...EVENTS };

        // [$resolver] = init(resolver.object(events));
        [$resolver] = init(resolver.directory(events));

        const middleware = [
            attributeMiddleware,
            argumentMiddleware,
            transactionMiddleware,
        ];

        [$bus] = init(bus($resolver, middleware, this.deps));
    })

    it('can be initialized', function() {
        assert($bus);
    })

    describe('invalid event modules', function() {
        let invalidEvent;

        beforeEach(function() {
            invalidEvent = {};

            events.invalid = invalidEvent;
        })

        it('fails if missing event name in route', async function() {
            try {
                await $bus.next({ route: '#action' }).value;
            } catch (e) {
                assert(_.isError(e));

                const { name, message } = e;
                assert.strictEqual(name, 'AssertionError', message);
            }
        })
    
        it('fails if missing trigger name in route', async function() {
            try {
                await $bus.next({ route: 'invalid' }).value;
            } catch (e) {
                assert(_.isError(e));

                const { name, message } = e;
                assert.strictEqual(name, 'AssertionError', message);
            }
        })
    
        it('fails if no trigger function provided', async function() {
            try {
                await $bus.next({ route: 'invalid#action' }).value;
            } catch (e) {
                assert(_.isError(e));

                const { name, message } = e;
                assert.strictEqual(name, 'InvalidEventModule', message);
                assert.strictEqual(message, 'route (name="invalid") does not define trigger function (name="action")');
            }
        })
    })

    describe('no metadata', function() {
        let caller;

        beforeEach(function() {
            caller = 'user';
        })
    
        it('invokes trigger function', async function() {
            const res = await $bus.next({ route: 'nometadata#action' }).value;

            assert.strictEqual(res, 'gello!');
        })

        it('constructs event correctly', async function() {
            const event = await $bus.next({ route: 'nometadata#action', caller, invoke: false }).value;

            assert.strictEqual(event.deps, this.deps);
            assert.strictEqual(event.caller, caller);
        })
    })

    describe('minimal metadata', function() {
        let minimal;

        beforeEach(function() {
            minimal = {
                __metadata: {},

                action: z => {}
            };

            events.minimal = minimal;
        })

        it('does not fail if empty', function() {
            return $bus.next({ route: 'minimal#action' }).value;
        })

        it('does not fail if triggers empty', function() {
            minimal.__metadata.triggers = {};

            return $bus.next({ route: 'minimal#action' }).value;
        })
    })

    describe('action trigger', function() {
        beforeEach(function() {
        })
    
        it('invokes action', async function() {
            const res = await $bus.next({ route: 'simple#action' }).value;

            assert.strictEqual(res, 'success');
        })

        it('route string only', async function() {
            const res = await $bus.next('simple#action').value;

            assert.strictEqual(res, 'success');
        })
    })

    describe('event arguments', function() {
        beforeEach(function() {
        })
    
        it('fails if required argment not provided', async function() {
            try {
                const trigger = {
                    route: 'paramterized#effect',
                    context: {
                        session$: {}
                    },
                }

                await $bus.next(trigger).value;

                assert.fail('should have thrown exception');
            } catch (e) {
                assert(_.isError(e));

                const { name, message } = e;

                // console.debug('#####', e);

                assert.strictEqual(name, 'RequiredParameterError');
                assert.strictEqual(message, 'call to event trigger (route="paramterized#effect") does not provide required argument (name="message")');
            }
        })

        it('does not fail if parameter is optional', async function() {
            const trigger = {
                route: 'paramterized#action',
                params: {
                    message: 'gello!'
                },
            }

            await $bus.next(trigger).value;
        })
    })

    describe('event context', function() {
        beforeEach(function() {
        })
    
        it('fails if required attribute not provided', async function() {
            try {
                const trigger = {
                    route: 'paramterized#effect',
                    params: {
                        message: 'gello!'
                    }
                }

                await $bus.next(trigger).value;

                assert.fail('should have thrown exception');
            } catch (e) {
                assert(_.isError(e));

                const { name, message } = e;

                assert.strictEqual(name, 'RequiredAttributeError');
                assert.strictEqual(message, 'call to event trigger (route="paramterized#effect") does not provide required context attribute (name="session$")');
            }
        })

        it('does not fail if attribute is optional', async function() {
            const trigger = {
                route: 'paramterized#action',
                params: {
                    message: 'gello!'
                },
                context: {
                    session$: {}
                },
            }

            await $bus.next(trigger).value;
        })
    })

    describe('transaction management', function() {
        let transactional;

        beforeEach(function() {
            transactional = {
                __metadata: {
                    triggers: {
                        effect: {
                            transaction: 'NEW'
                        }
                    }
                },

                effect: event => {
                    const { $txn } = event.context || {};

                    $txn.next({ operation: 'put', item: { id: '222', parentId: '444', message: 'gello!' } });
                }
            };

            events.transactional = transactional;
        })

        describe('mode NEW', function() {
            beforeEach(function() {
            })
        
            it('commits transaction', async function() {
                await $bus.next({ route: 'transactional#effect' }).value;

                const [item$] = this.store.select({ message: 'gello!' });

                assert(item$);
            })

            it('fails if $txn provided', async function() {
                const e = {
                    route: 'transactional#effect',
                    context: {
                        $txn: this.store.write()
                    }
                };

                return assert.rejects(z => $bus.next(e).value);
            })
        })

        describe('mode REQUIRED', function() {
            beforeEach(function() {
                transactional.__metadata.triggers.effect.transaction = 'REQUIRED';
            })
        
            it('fails if no $txn provided', async function() {
                const e = {
                    route: 'transactional#effect',
                };

                return assert.rejects(z => $bus.next(e).value);
            })

            it('writes to the transaction', async function() {
                const $txn = this.store.write();
                const e = {
                    route: 'transactional#effect',
                    context: {
                        $txn
                    }
                };

                await $bus.next(e).value;
                await $txn.return().value;

                const [item$] = this.store.select({ message: 'gello!' });

                assert(item$);
            })
        })

        describe('mode JOIN', function() {
            beforeEach(function() {
                transactional.__metadata.triggers.effect.transaction = 'JOIN';
            })
        
            it('commits new if no $txn provided', async function() {
                const e = {
                    route: 'transactional#effect',
                };

                await $bus.next(e).value;

                const [item$] = this.store.select({ message: 'gello!' });
                assert(item$);
            })

            it('does not commit if $txn provided', async function() {
                const e = {
                    route: 'transactional#effect',
                    context: {
                        $txn: this.store.write()
                    }
                };

                await $bus.next(e).value;

                const [item$] = this.store.select({ message: 'gello!' });
                assert(!item$);
            })

            it('writes to the transaction if $txn provided', async function() {
                const $txn = this.store.write();
                const e = {
                    route: 'transactional#effect',
                    context: {
                        $txn
                    }
                };

                await $bus.next(e).value;
                await $txn.return().value;

                const [item$] = this.store.select({ message: 'gello!' });
                assert(item$);
            })
        })
    })

    describe('overridding dependencies', function() {
        beforeEach(function() {
            this.deps.define('message', 'gello');

            events.override = {
                __metadata: {
                    triggers: {
                        job: {}
                    }
                },

                job: event => {
                    const { deps } = event;

                    return deps.resolveSingle('message')
                }
            }
        })

        it('uses overridden dependency', async function() {
            const e = {
                route: 'override#job',
                deps: this.deps.branch({ message: 'world!' })
            }

            const message = await $bus.next(e).value;

            assert.strictEqual(message, 'world!');
        })

        it('resolves correctly if not overriden', async function() {
            const e = {
                route: 'override#job',
            }

            const message = await $bus.next(e).value;

            assert.strictEqual(message, 'gello');
        })
    })
})