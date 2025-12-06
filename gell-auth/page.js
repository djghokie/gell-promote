const assert = require('assert');
const _ = require('lodash');

const { State } = require('gell');

const { getServerSession } = require("next-auth");

const DEFAULT_OPTIONS = {
    signinUrl: '/api/auth/signin',
    unauthorizedUrl: '/unauthorized'   
}

/**
 * Server side Handler for "protected" pages (role required to access)
 * 
 * BENEFITS of this approach
 * 	- reusable across many pages
 * 	- unit testable
 * 
 * WIP
 * 	- could break out into a directory with handler per file
 * 
 * WIP: 0.6.0 changes
 * 	- allow for any authenticated session
 * 		- could pass in "*" as allowedRoles
 */
exports.protectedPage = function*(allowedRoles, authOptions, f, options=DEFAULT_OPTIONS) {
    assert(_.isArray(allowedRoles));
    assert(authOptions);
    assert(options);

    const { unauthorizedUrl, signinUrl } = _.defaults(options, DEFAULT_OPTIONS);
    assert(signinUrl);
    assert(unauthorizedUrl);

	const config = new State();

	let context = yield config;

	async function authorize(context) {
        const session = await getServerSession(context.req, context.res, authOptions);

        if (!session) {
            return {
                redirect: { destination: signinUrl, permanent: false },
            };
        }
    
		if (allowedRoles) {
            const { role } = session;
            
			// TODO: probably use lodash intersection
			// const firstMatching = allowedRoles.find(ar => roles.find(r => r === ar));
			const firstMatching = allowedRoles.find(ar => ar === role);
			if (!firstMatching) {
				return {
					redirect: {
                        destination: unauthorizedUrl,
						permanent: false
					}
				};
			}
		}
		
        const response = f ? f(context) : { props: {} };

        // getServerSide props serialization
        if (session.user) {
            if (!session.user.name) session.user.name = null;
            if (!session.user.email) session.user.email = null;
            if (!session.user.image) session.user.image = null;
        }

		if (response.props) {
			// if (token) response.props.token = token;  // pass the session JWT to be used for ws authorization
			response.props.session = session;
			// response.props.user = user.snapshot();
		}

		context.session = session;
		// context.user = user;

		return response;
    }

    while (true) {
		assert(context);

		context = yield authorize(context);
	}
}
