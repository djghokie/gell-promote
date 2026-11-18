exports.__metadata = {
    name: 'unittest.note',
    description: 'returns a NOTE by id',
    triggers: {
        effect: {
            params: {
                id: 'uuid',
            }
        },
        api: {
            params: {
                id: 'uuid',
            }
        }
    }
}

exports.effect = async function() {
    throw new Error('NYI');
}

exports.api = exports.effect;
