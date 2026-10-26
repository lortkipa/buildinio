/** Cookies that carry an OAuth sign-in from the button press to the callback. */
export const OAUTH_COOKIES = {
  state: "oauth_state",
  codeVerifier: "oauth_code_verifier",
  from: "oauth_from", // "signup" or "login": the page to return to on errors.
};
