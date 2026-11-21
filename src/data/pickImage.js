import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Images are stored inline (as data URIs) next to the department data, so they are
// shrunk first to keep device storage small.
const MAX_WIDTH = 800;

// Opens the photo library (must be called straight from a button press on web).
// Resolves to { uri } with a JPEG data URI, { canceled: true }, or { error }.
export async function pickAndCompressImage() {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return { canceled: true };

    const asset = result.assets[0];
    const context = ImageManipulator.manipulate(asset.uri);
    if (!asset.width || asset.width > MAX_WIDTH) {
      context.resize({ width: MAX_WIDTH });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
    if (!saved.base64) return { error: 'Could not read the image. Please try another one.' };
    return { uri: `data:image/jpeg;base64,${saved.base64}` };
  } catch {
    return { error: 'Could not open the image. Please try another one.' };
  }
}
