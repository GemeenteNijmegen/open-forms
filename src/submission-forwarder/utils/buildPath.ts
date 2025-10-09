import { createNormalizedFolderName } from './normalizeInput';
/**
 * Returns a full network path of the (karelstad) folder
 * @param networkShare
 * @param formName
 * @param reference
 * @returns
 */

export function createFullNetworkPath(networkShare: string, formName: string, reference: string) {
  return `<${replaceForwardSlashes(networkShare)}\\${createNormalizedFolderName(formName, reference)}>`;
}

/**
 * @param stringToTransform
 * @returns string without forward slashes, only backslashes
 */
export function replaceForwardSlashes(stringToTransform: string | undefined | null): string {
  if (!stringToTransform) {
    return '';
  }
  if (stringToTransform.includes('/')) {
    return stringToTransform.replace(/\//g, '\\');
  }
  return stringToTransform;
}
