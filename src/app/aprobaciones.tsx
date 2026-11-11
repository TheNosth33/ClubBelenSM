import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useData, useMe } from '../data/DataContext';
import { can } from '../data/permissions';
import { userById } from '../data/selectors';
import { MemberRow } from '../components/Items';
import { Button, Card, EmptyState, Screen, Segmented, Tag } from '../components/ui';
import { colors } from '../theme';
import { timeAgo } from '../utils/dates';
import { summarizeAction } from '../data/engine';
import { showMessage } from '../utils/alerts';

/** Cambios de Directores Asociados esperando aprobación del Director o del Director General. */
export default function Approvals() {
  const { db, approvePending, rejectPending } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    const err = await (approve ? approvePending(id) : rejectPending(id));
    setBusy(null);
    if (err) showMessage('No se pudo guardar', err);
  };
  const me = useMe();
  const [tab, setTab] = useState<'pendiente' | 'historial'>('pendiente');
  const mine = db.pending.filter((p) => me.isGeneralDirector || can(me, 'approve_changes', p.clubId) || p.createdBy === me.id);
  const list = mine.filter((p) => (tab === 'pendiente' ? p.status === 'pendiente' : p.status !== 'pendiente'));

  return (
    <Screen edges={['bottom']}>
      <View style={{ marginVertical: 12 }}>
        <Segmented
          options={[
            { value: 'pendiente', label: `Pendientes (${mine.filter((p) => p.status === 'pendiente').length})` },
            { value: 'historial', label: 'Historial' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {list.length === 0 ? <EmptyState icon="shield-checkmark-outline" text={tab === 'pendiente' ? 'No hay cambios esperando aprobación.' : 'Sin historial.'} /> : null}
      {list.map((p) => {
        const author = userById(db, p.createdBy);
        const reviewer = p.reviewedBy ? userById(db, p.reviewedBy) : undefined;
        const canDecide = p.status === 'pendiente' && (me.isGeneralDirector || can(me, 'approve_changes', p.clubId));
        return (
          <Card key={p.id} style={{ marginBottom: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Tag label={db.clubs[p.clubId].name} color={db.clubs[p.clubId].color} />
              {p.status !== 'pendiente' ? <Tag label={p.status === 'aprobado' ? 'Aprobado' : 'Rechazado'} color={p.status === 'aprobado' ? colors.success : colors.danger} /> : null}
            </View>
            {/* El resumen se calcula de la acción real, no del texto que envió quien la pidió. */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{p.status === 'pendiente' ? summarizeAction(db, p.action) : p.summary}</Text>
            {p.action.type === 'createNotice' ? <Text style={{ color: colors.textMuted }}>“{p.action.data.body}”</Text> : null}
            {p.action.type === 'createActivity' ? <Text style={{ color: colors.textMuted }}>{p.action.data.location} · {p.action.data.startTime}</Text> : null}
            {author ? <MemberRow user={author} right={<Text style={{ fontSize: 12, color: colors.textMuted }}>{timeAgo(p.createdAt)}</Text>} /> : null}
            {reviewer ? <Text style={{ fontSize: 12, color: colors.textMuted }}>Revisado por {reviewer.fullName}</Text> : null}
            {canDecide ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Aprobar" icon="checkmark" variant="success" small style={{ flex: 1 }} loading={busy === p.id} onPress={() => decide(p.id, true)} />
                <Button title="Rechazar" icon="close" variant="ghost" small style={{ flex: 1 }} disabled={busy === p.id} onPress={() => decide(p.id, false)} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}
