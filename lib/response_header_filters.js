'use strict';

const P = require('bluebird');
const HTTPError = require('hyperswitch').HTTPError;

const cspHeaderVariants = [
    'content-security-policy',
    // For IE 10 & 11
    'x-content-security-policy',
    // For Chrome <= v25 (<<1% traffic; todo: revisit support)
    'x-webkit-csp'
];

/**
 * Adds Content-Security-Policy & related headers to send in response
 * @param  {HyperSwitch} hyper   the HyperSwitch object
 * @param  {Object}      req     the request to handle
 * @param  {P}           next    the promise to execute
 *
 * @return {Promise}
 */
module.exports = function addResponseHeaders(hyper, req, next) {
    let resPromise;
    if (req.method === 'options') {
        resPromise = P.resolve({
            status: 200,
            headers: {}
        });
    } else {
        resPromise = next(hyper, req);
    }

    const addHeaders = (res) => {
        if (!res.headers) {
            res.headers = {};
        }

        const rh = res.headers;

        // Set up basic CORS headers
        rh['access-control-allow-origin'] = '*';
        rh['access-control-allow-methods'] = 'GET,HEAD';
        rh['access-control-allow-headers'] =
            'accept, content-type, content-length, cache-control, accept-language, ' +
            'api-user-agent, if-match, if-modified-since, if-none-match, ' +
            // There's a bug in Safari 9 that makes it require these as allowed headers
            'dnt, accept-encoding';
        rh['access-control-expose-headers'] = 'etag';

        // Set up security headers
        // https://www.owasp.org/index.php/List_of_useful_HTTP_headers
        rh['x-content-type-options'] = 'nosniff';
        rh['x-frame-options'] = 'SAMEORIGIN';

        // Restrict referrer forwarding
        // (https://phabricator.wikimedia.org/T173509)
        rh['referrer-policy'] = 'origin-when-cross-origin';

        let csp;
        if (rh['content-security-policy']) {
            csp = rh['content-security-policy'];
        } else {
            // Other content: Disallow everything, especially framing to avoid
            // re-dressing attacks.
            csp = "default-src 'none'; frame-ancestors 'none'";
        }
        rh['x-xss-protection'] = '1; mode=block';

        // Finally, assign the csp header variants
        cspHeaderVariants.forEach((name) => {
            rh[name] = csp;
        });

        return res;
    };

    return resPromise.then(addHeaders, (e) => {
        if (e.name !== 'HTTPError') {
            e = HTTPError.fromError(e);
        }
        e = addHeaders(e);
        throw e;
    });
};
