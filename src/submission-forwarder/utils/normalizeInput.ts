/**
 * Makes sure word karelstad never has uppercase
 * If the path contains anything other lowercase karelstad with // or \\
 * it will add another karelstad to the path in the esb processing, which will result in unknown paths
 * This makes sure accidental non-lowercase karelstads in the variables are dealt with
 * @param path
 * @returns
 */
export function normalizeKarelstad(path: string): string {
  return path.replace(/^([\\/]{2})karelstad(?=[\\/]|$)/i, '$1karelstad');
}
/**
 * Only return characters that are letters or numbers
 * Removes unwanted characters
 */

export const normalizeToAlphanumericString = (s: string): string =>
  s.replace(/[^A-Za-z0-9]/g, '');


/**
 * Removes all non-basic characters from the formName
 * and create a folderName that contains the normalized formName and reference
 */

export function createNormalizedFolderName(formName: string, reference: string) {
  return `${normalizeToAlphanumericString(formName)}-${reference}`;
}