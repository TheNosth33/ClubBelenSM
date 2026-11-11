import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useData } from '../../data/DataContext';
import { PasswordStrength } from '../../components/UserForm';
import { Button, Field, Screen } from '../../components/ui';
import { showMessage } from '../../utils/alerts';

export default function ChangePassword() {
  const { changeMyPassword } = useData();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError(null);
    if (next !== next2) return setError('Las contraseñas nuevas no coinciden.');
    setLoading(true);
    const err = await changeMyPassword(current, next);
    setLoading(false);
    if (err) return setError(err);
    showMessage('Contraseña actualizada');
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ height: 12 }} />
      <Field label="Contraseña actual" value={current} onChangeText={setCurrent} secureTextEntry />
      <Field label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry />
      <Field label="Confirmar nueva contraseña" value={next2} onChangeText={setNext2} secureTextEntry error={error} />
      <PasswordStrength pw={next} />
      <Button title="Guardar" icon="checkmark" onPress={save} loading={loading} disabled={!current || !next} style={{ marginTop: 10 }} />
    </Screen>
  );
}
