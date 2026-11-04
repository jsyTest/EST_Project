import {reject} from './review-errors.mjs';

// Evidence for this request only. It is neither a user allowlist nor Notion approval.
export const OWNERSHIP_VERIFICATION = Object.freeze({serverAuthVerified: true, draftOwnerVerified: true});

export async function readVerifiedOwnedDraft(client, draftId, signal) {
  const current = () => { if (signal?.aborted) reject(401, 'invalid_session'); };
  current();
  const user = await client.getUser();
  current();
  const row = await client.getDraft(draftId, user.id);
  current();
  // Keep the comparison local; never return the Auth UUID or owner UUID as evidence.
  if (typeof row?.id !== 'string' || row.id.toLowerCase() !== draftId ||
      typeof row?.user_id !== 'string' || row.user_id.toLowerCase() !== user.id) reject(404, 'draft_not_found');
  return row;
}
