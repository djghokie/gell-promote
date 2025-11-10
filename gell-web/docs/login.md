/**
 * Login flow notes
 * 
 * 	- flow spans multiple http requests
 * 		- initiated by request for a secured page
 * 		- user is presented login page
 * 		- user is routed to secured page
 * 	- requests may be page or api requests
 * 	- state must be persisted somehow
 * 		- cookies probably make the most sense
 * 		- could potentially store in JWT although that probably doesn't make as much sense
 * 		- should be a common gell capability to snapshot/materialize from cookie
 * 	- use ecosystem snapshot page to drive this implementation
 * 	- how is this related to the session lifecycle?
 * 
 * Generator/lifecycle notes
 * 	- login flow (the generator) would be created from another sequence/lifecycle
 * 		- is this the authority?
 * 	- as i'm writing this does this require the gell-replay functionality i was thinking of earlier?
 * 		- challenge is to accurately restore the generator to the correct state between requests
 * 	- perhaps this isn't named "login" but something that refers to "secure page access"
 * 	- as a general note, this allows the developer to define a long running, async process in a single method
 */
