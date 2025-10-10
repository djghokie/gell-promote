const { v4: uuid } = require('uuid');

const Projection = require('gell/lib/projection');
const materialize = require('gell/state/materialize');

const session = require('gell-session/domain/session');
const javascript = require('gell-domain/binding/javascript');

const TYPE = "TEMPLATE";

const model = {
    extends: [session.model],
    attributes: {
        type: {
            type: 'string',
            default: TYPE
        },
        instanceType: 'string'
    }
}

module.exports = {
    TYPE,
    model,
    // materialize: session$ => javascript.materialize(session$, model),
    /**
     * WIP: this still isn't right
     *  - application would define the "factory" model
     *  - proabably should be a method on gell-domain javascript
     *      - javascript.factory(template$, factoryModel)
     */
    materialize: template$ => {
        const factory_ = materialize.all(template$);
        factory_.set('type', function() { return this.get('instanceType') });
        factory_.set('id', z => uuid());
        factory_.set('initiatedTs', z => Date.now());

        return factory_;
    },
    project: session_ => {
        const template_ = new Projection(session_);
        template_.reflect(...session_.attributes());
        template_.alias('type', 'instanceType');
        template_.set('type', TYPE);

        return template_;
    }
}