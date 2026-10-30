import {createReviewHandler} from '../../server/drafts-review.mjs';

// Native Vercel Node Web-standard entry point; no session or token state is shared.
export default {fetch: createReviewHandler()};
