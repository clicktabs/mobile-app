import { ApiError } from './client';
import * as staffApi from './staff';
import { storageGet, storageSet } from '../utils/storage';

/**
 * Documentation written without a connection.
 *
 * EVV clock-in and clock-out have queued for a while; notes did not. That was tolerable
 * while offline was something a caregiver chose deliberately. Now that the app goes
 * offline on its own, a nurse can write a full visit note in a house with no signal, and
 * without this it would be lost on save.
 *
 * Ordering is the subtle part. A note for a visit the server has never heard of is
 * rejected, so this queue is flushed AFTER the EVV queue, and within itself in the order
 * things were written.
 */

const QUEUE_KEY = 'ct_doc_offline_queue';
const REJECTED_KEY = 'ct_doc_offline_rejected';

/** Give up re-sending after this many attempts and park it for review. */
const MAX_ATTEMPTS = 5;

export type QueuedDocKind = 'nursing_note' | 'hha_note' | 'missed_visit_note';

export type QueuedDoc = {
  id: string;
  kind: QueuedDocKind;
  schedule_id: number;
  /** What the caregiver would have sent had there been a connection. */
  payload: Record<string, unknown>;
  queued_at: string;
  attempts?: number;
};

export type RejectedDoc = QueuedDoc & {
  rejected_reason: string;
  rejected_at: string;
};

async function readList<T>(key: string): Promise<T[]> {
  const raw = (await storageGet(key)) || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Hold a document until there is a connection.
 *
 * One queued document per schedule per kind: writing the note again before it has synced
 * replaces the earlier version rather than queueing a second one, because two notes for
 * one visit is not what the caregiver meant.
 */
export async function queueDocument(
  kind: QueuedDocKind,
  scheduleId: number,
  payload: Record<string, unknown>,
): Promise<QueuedDoc> {
  const list = await readList<QueuedDoc>(QUEUE_KEY);

  const doc: QueuedDoc = {
    id: newId(),
    kind,
    schedule_id: scheduleId,
    payload,
    queued_at: new Date().toISOString(),
    attempts: 0,
  };

  const without = list.filter(
    (d) => !(d.kind === kind && Number(d.schedule_id) === Number(scheduleId)),
  );

  await storageSet(QUEUE_KEY, JSON.stringify([...without, doc]));

  return doc;
}

export async function pendingDocumentCount(): Promise<number> {
  return (await readList<QueuedDoc>(QUEUE_KEY)).length;
}

export async function queuedDocumentFor(
  kind: QueuedDocKind,
  scheduleId: number,
): Promise<QueuedDoc | null> {
  const list = await readList<QueuedDoc>(QUEUE_KEY);
  return list.find((d) => d.kind === kind && Number(d.schedule_id) === Number(scheduleId)) ?? null;
}

export async function rejectedDocuments(): Promise<RejectedDoc[]> {
  return readList<RejectedDoc>(REJECTED_KEY);
}

export async function clearRejectedDocuments() {
  await storageSet(REJECTED_KEY, '[]');
}

/** Send one document the way its screen would have. */
async function send(token: string, doc: QueuedDoc): Promise<void> {
  const payload = doc.payload as never;

  switch (doc.kind) {
    case 'nursing_note':
      await staffApi.saveNursingNote(token, payload);
      return;
    case 'hha_note':
      await staffApi.saveHhaNote(token, payload);
      return;
    case 'missed_visit_note':
      await staffApi.saveMissedVisitNote(token, doc.schedule_id, payload);
      return;
    default:
      throw new ApiError(`Unknown queued document kind: ${doc.kind}`, 400);
  }
}

/**
 * Upload queued documentation.
 *
 * Stops at the first network failure rather than marking everything as attempted: if the
 * connection has gone again, nothing that follows is the document's fault and none of it
 * should count against its retry budget.
 */
export async function flushDocumentQueue(token: string): Promise<{
  flushed: number;
  rejected: number;
  retrying: number;
}> {
  const list = await readList<QueuedDoc>(QUEUE_KEY);

  if (!list.length) {
    return { flushed: 0, rejected: 0, retrying: 0 };
  }

  const keep: QueuedDoc[] = [];
  const rejected: RejectedDoc[] = [];
  let flushed = 0;
  let offline = false;

  for (const doc of list) {
    if (offline) {
      keep.push(doc);
      continue;
    }

    try {
      await send(token, doc);
      flushed += 1;
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;

      if (status === 0) {
        // The connection went. Keep this and everything after it, untouched.
        offline = true;
        keep.push(doc);
        continue;
      }

      const attempts = (doc.attempts ?? 0) + 1;

      // A validation refusal will be refused identically forever; a 401 or a 500 may not.
      const permanent = status === 422 || status === 404 || status === 403;

      if (permanent || attempts >= MAX_ATTEMPTS) {
        rejected.push({
          ...doc,
          rejected_reason: e instanceof ApiError ? e.message : 'unknown error',
          rejected_at: new Date().toISOString(),
        });
        continue;
      }

      keep.push({ ...doc, attempts });
    }
  }

  await storageSet(QUEUE_KEY, JSON.stringify(keep));

  if (rejected.length) {
    const existing = await readList<RejectedDoc>(REJECTED_KEY);
    await storageSet(REJECTED_KEY, JSON.stringify([...existing, ...rejected]));
  }

  return { flushed, rejected: rejected.length, retrying: keep.length };
}
