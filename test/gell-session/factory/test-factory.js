const assert = require('assert');
const _ = require('lodash');

const { v4: uuid } = require('uuid');

const { State } = require('gell');
const Projection = require('gell/lib/projection');
const materialize = require('gell/state/materialize');

const javascript = require('gell-domain/binding/javascript');
const session = require('gell-session/domain/session');

const template = require('../../../gell-session/domain/template');

const testModel = {
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: "TEST"
        },
        title: {
            type: 'string',
            editable: true
        },
        message: {
            type: 'string',
            default: 'gello!'
        }
    }
}

const templateModel = {
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: "TEMPLATE"
        },
        instanceType: 'string'
    }
}

/**
 * WIP: attempting to solve the factory problem
 *  - create new instances of a session based on a "template"
 *  - some attributes are cloned from the template
 *  - other attributes are generated
 *  - might be moved to top level gell package
 *  - need to support snapshot and materialize use cases
 *      - snapshot to support saving in database
 *      - materialize to support reading from database
 *  - what produces the instances?
 *      - ideally snapshot would
 *  - type has to be different than the target session type
 *  - need some process of creating a "factory"
 *      - in this case, I mean a factory is producing the instances
 *      - almost like you want to merge models
 *          - template model and target type model
 */
describe('session factory', function() {
    let session_, template_;

    beforeEach(function() {
        session_ = javascript.materialize({ title: 'foo' }, testModel);

        // WIP: so a template is a just a projection of the state
        template_ = new Projection(session_);
        template_.reflect(...session_.attributes());
        template_.alias('type', 'instanceType');
        template_.set('type', 'TEMPLATE');
    })

    it('creates template correctly from state', function() {
        const template$ = template_.snapshot();

        assert.strictEqual(template$.type, 'TEMPLATE');
        assert.strictEqual(template$.instanceType, 'TEST');
        assert.strictEqual(template$.title, 'foo');
        assert.strictEqual(template$.message, 'gello!');
    })

    it('creates template correctly from type', function() {
        const template_ = template.project(session_);

        const template$ = template_.snapshot();

        assert.strictEqual(template$.type, 'TEMPLATE');
        assert.strictEqual(template$.instanceType, 'TEST');
        assert.strictEqual(template$.title, 'foo');
        assert.strictEqual(template$.message, 'gello!');
    })

    it('template materializes factory', function() {
        const factory_ = template.materialize(template_.snapshot());
        
        const instanceOne$ = factory_.snapshot();

        // console.debug('#####', instanceOne$);

        assert.strictEqual(instanceOne$.title, 'foo');
    })

    describe('no cloned attributes', function() {
        let factory_;

        beforeEach(function() {
            const template$ = template_.snapshot();

            factory_ = materialize.all(template$);
            factory_.set('type', function() { return this.get('instanceType') });
            factory_.set('id', z => uuid());
            factory_.set('initiatedTs', z => Date.now());
        })
    
        it('generates multiple unique instances', function() {
            const instanceOne$ = factory_.snapshot();
            const instanceTwo$ = factory_.snapshot();
            // const instanceOne$ = template_.snapshot();
            // const instanceTwo$ = template_.snapshot();

            // console.debug('#####', instanceOne$);
            // console.debug('#####', instanceTwo$);

            assert.strictEqual(instanceOne$.type, 'TEST');
            assert.strictEqual(instanceTwo$.type, 'TEST');

            assert.notStrictEqual(instanceOne$.id, instanceTwo$.id);
        })
    })

    describe('cloned attributes', function() {
        let factory_;

        beforeEach(function() {
            const template$ = template_.snapshot();

            factory_ = materialize.all(template$);
            factory_.set('type', function() { return this.get('instanceType') });
            factory_.set('id', z => uuid());
            factory_.set('initiatedTs', z => Date.now());
        })
    
        it('clones attributes correctly', function() {
            // template_.set('title', 'foo');

            const instanceOne$ = factory_.snapshot();

            // console.debug('#####', instanceOne$);

            assert.strictEqual(instanceOne$.title, 'foo');
        })
    
        it('generates multiple unique instances', function() {
            const instanceOne$ = factory_.snapshot();
            const instanceTwo$ = factory_.snapshot();

            // console.debug('#####', instanceOne$);
            // console.debug('#####', instanceTwo$);

            assert.strictEqual(instanceOne$.type, 'TEST');
            assert.strictEqual(instanceTwo$.type, 'TEST');

            assert.notStrictEqual(instanceOne$.id, instanceTwo$.id);
        })
    })

    describe('defaulted attributes', function() {
        let mergedModel;
        let factory_;

        beforeEach(function() {
            const template$ = template_.snapshot();

            factory_ = materialize.all(template$);
            factory_.set('type', function() { return this.get('instanceType') });
            factory_.set('id', z => uuid());
            factory_.set('initiatedTs', z => Date.now());
        })

        it('clones attributes correctly', function() {
            const instanceOne$ = factory_.snapshot();

            // console.debug('#####', instanceOne$);

            assert.strictEqual(instanceOne$.message, 'gello!');
        })
    
        it('generates multiple unique instances', function() {
            const instanceOne$ = factory_.snapshot();
            const instanceTwo$ = factory_.snapshot();

            // console.debug('#####', instanceOne$);
            // console.debug('#####', instanceTwo$);

            assert.strictEqual(instanceOne$.type, 'TEST');
            assert.strictEqual(instanceTwo$.type, 'TEST');

            assert.notStrictEqual(instanceOne$.id, instanceTwo$.id);
        })
    })

    describe.skip('breaking it down further', function() {
        beforeEach(function() {
        })
    
        it('works', function() {
            /**
             * WIP: a factory is just a State with dynamically generated attributes
             */
            const s_ = new State();
            s_.set('ts', z => new Date());  // regenerates for each instance

            const s$ = s_.snapshot();

            console.debug('#####', s$);
        })
    })
})
