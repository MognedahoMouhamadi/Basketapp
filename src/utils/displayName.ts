type PlayerLookupValue =
  | string
  | {
      displayName?: string | null;
    }
  | undefined;

export type PlayersById = Record<string, PlayerLookupValue>;

const DEFAULT_FALLBACK = '...';

// Normalizes a candidate display name and ignores empty values.
const cleanName = (value?: string | null): string | null => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
};

// Converts an id to a short UI-safe token (never full raw id).
const shortenId = (value?: string | null): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_FALLBACK;
  if (raw.length <= 1) return '...';
  if (raw.length <= 3) return `${raw.slice(0, 1)}...`;
  return `${raw.slice(0, 3)}...${raw.slice(-3)}`;
};

// Protects UI from showing a raw id even if it was persisted as displayName.
const avoidRawId = (candidate: string | null, playerId?: string | null): string => {
  const safeId = String(playerId ?? '').trim();
  if (!candidate) return shortenId(safeId);
  if (safeId && candidate === safeId) return shortenId(safeId);
  return candidate;
};

// Priority order:
// 1) participantDisplayName
// 2) playersById[playerId].displayName (or string map value)
// 3) shortened id fallback
export const getDisplayName = (
  playerId?: string | null,
  participantDisplayName?: string | null,
  playersById?: PlayersById
): string => {
  const fromParticipant = cleanName(participantDisplayName);
  if (fromParticipant) return avoidRawId(fromParticipant, playerId);

  const key = String(playerId ?? '').trim();
  const fromLookup = key ? playersById?.[key] : undefined;
  const fromPlayersById =
    typeof fromLookup === 'string'
      ? cleanName(fromLookup)
      : cleanName(fromLookup?.displayName);
  if (fromPlayersById) return avoidRawId(fromPlayersById, key);

  return shortenId(key);
};
