import { deduplicateFileNames } from './deduplicateFileNames';
import { FileData } from './s3PathsFromFileData';

/**
* Adds references (type of file, submission or pdf) to the fileData. This then can enrich the response.
*
* @param orderedFileData fileData array, with the first element assumed to be the submission PDF, and all others assumed to be attachments
* @param reference submision reference
* @returns fileData array, enriched with type
*/

export function addTypeReferencesToFileData(orderedFileData: FileData[], reference: string) {
  orderedFileData[0].filename = `${reference}.pdf`;
  orderedFileData[0].type = 'submission';
  orderedFileData = deduplicateFileNames(orderedFileData).map((file: FileData) => {
    return {
      ...file,
      type: file.type ?? 'attachment',
    };
  });
  return orderedFileData;
}
