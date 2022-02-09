import { serialize } from 'cookie';

/**
 * Defines the max cookie size before we start splitting cookies into multiple
 * parts.
 *
 * inspired by
 * @see https://github.com/auth0/nextjs-auth0/blob/443171b74074eaec5b0e8db6380b05cc359e505e/src/auth0-session/cookie-store.ts#L12
 */
const MAX_COOKIE_SIZE = 4096;

/**
 * At the moment we do not support customizing the cookie and
 *
 * NOTE: If necessary, enable feature (via .env) to further customize cookie options
 * @see https://github.com/auth0/nextjs-auth0/blob/7ca367a1e0e13f83cfc5d74cbc56dbb486df10a0/src/config.ts#L472-L480
 *
 * @type {import('cookie').CookieSerializeOptions}
 */
const COOKIE_OPTIONS = {
  domain: Cypress.env('auth0CookieDomain'),
};

const SESSION_COOKIE_NAME = Cypress.env('auth0SessionCookieName');

/**
 * We need to handle cookie splitting because nextjs-auth0 does not export its
 * own CookieHelper. We need to split the cookie into multiple cookies if they
 * exceed a certain size.
 *
 * ## References
 *
 * Inspired by
 * @see https://github.com/auth0/nextjs-auth0/blob/443171b74074eaec5b0e8db6380b05cc359e505e/src/auth0-session/cookie-store.ts#L12
 * @see https://github.com/auth0/nextjs-auth0/blob/443171b74074eaec5b0e8db6380b05cc359e505e/src/auth0-session/cookie-store.ts#L153-L209
 *
 * The logic how we split cookies is based on the following example:
 * @see https://github.com/auth0/nextjs-auth0/blob/443171b74074eaec5b0e8db6380b05cc359e505e/src/auth0-session/cookie-store.ts#L187-L207
 *
 * ## Related Issues
 *
 * CookieHelper is not exposed (yet):
 * @see https://github.com/auth0/nextjs-auth0/issues/335#issuecomment-799401740
 */
export const handleAuth0Cookie = encryptedSession => {
  const emptyCookie = serialize(`${SESSION_COOKIE_NAME}.0`, '', COOKIE_OPTIONS);
  const chunkSize = MAX_COOKIE_SIZE - emptyCookie.length;

  const value = encryptedSession;
  const chunkCount = Math.ceil(value.length / chunkSize);

  if (chunkCount > 1) {
    for (let i = 0; i < chunkCount; i++) {
      const chunkValue = value.slice(i * chunkSize, (i + 1) * chunkSize);
      const chunkCookieName = `${SESSION_COOKIE_NAME}.${i}`;

      cy.setCookie(chunkCookieName, chunkValue, COOKIE_OPTIONS);
    }

    // delete the cookie that is not splitted to ensure that auth0 uses only
    // the splitted ones.
    cy.setCookie(SESSION_COOKIE_NAME, '', {
      expiry: 0,
    });
  } else {
    // set one main cookie because its value does not exceed the max size
    cy.setCookie(SESSION_COOKIE_NAME, value, COOKIE_OPTIONS);

    // clear other SESSION_COOKIE_NAME.{i} cookies in order to have
    // only one left that is used by auth0
    // https://github.com/auth0/nextjs-auth0/blob/443171b74074eaec5b0e8db6380b05cc359e505e/src/auth0-session/cookie-store.ts#L202-L205
    cy.getCookies().then(cookies => {
      cookies.forEach(cookie => {
        if (cookie.name.startsWith(SESSION_COOKIE_NAME)) {
          cy.setCookie(cookie.name, '', {
            expiry: 0,
          });
        }
      });
    });
  }
};