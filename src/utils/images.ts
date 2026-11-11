import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './users';

/** Abre la galería y devuelve la URI temporal de la imagen elegida (o null). */
export async function pickImageUri(aspect: [number, number]): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.6,
    base64: Platform.OS === 'web',
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.base64) return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  return asset.uri;
}

/** Modo demostración: copia la imagen a la carpeta de la app para que no se pierda. */
export function persistLocally(uri: string): string {
  if (Platform.OS === 'web') return uri;
  try {
    const dir = new Directory(Paths.document, 'imagenes');
    if (!dir.exists) dir.create({ idempotent: true });
    const dest = new File(dir, `${newId()}.${extensionOf(uri)}`);
    new File(uri).copySync(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export function extensionOf(uri: string): string {
  const dataMatch = /^data:image\/(\w+);/.exec(uri);
  if (dataMatch) return dataMatch[1] === 'jpeg' ? 'jpg' : dataMatch[1];
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && ext.length <= 4 ? ext : 'jpg';
}

export function mimeOf(ext: string): string {
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' } as Record<string, string>)[ext] ?? 'image/jpeg';
}

/** Lee la imagen como bytes para subirla a la nube. */
export async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' || uri.startsWith('data:') || uri.startsWith('blob:')) {
    return (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}
