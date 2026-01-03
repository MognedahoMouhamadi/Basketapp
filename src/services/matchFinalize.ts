// src/services/matchFinalize.ts
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Clôture proprement un match en ne mettant à jour que les champs autorisés.
 * Seuls l'arbitre ou le créateur peuvent réaliser cette action.
 */
export async function endMatch(matchId: string, uid?: string | null) {
  if (!matchId) throw new Error('Identifiant de match manquant');
  if (!uid) throw new Error('Utilisateur requis');

  const ref = doc(db, 'matches', matchId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Match introuvable');
    const data = snap.data() as any;

    if (data.refereeId !== uid && data.createdBy !== uid) {
      throw new Error('Seul l’arbitre ou le créateur peut terminer ce match');
    }

    if (data.status === 'closed') return;

    tx.update(ref, {
      status: 'closed',
      endedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}
