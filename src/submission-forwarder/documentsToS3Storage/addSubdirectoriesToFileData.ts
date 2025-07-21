import { join } from 'path';
import { FileData } from './s3PathsFromFileData';

/**
* Adds a subdirctory to the fileData.
*
* @param fileData array of files to later store
* @param subdirectory submision subdriectory (e.g. VIP or Jz4all)
* @returns fileData array, with subdirectories type
*/

export function addSubdirctoriesToFileData(fileData: FileData[], subdirectory: string) {
  fileData = fileData.map((file: FileData) => {
    const data: FileData = {
      ...file,
      filename: join(subdirectory, file.filename),
    };
    return data;
  });
  return fileData;
}
