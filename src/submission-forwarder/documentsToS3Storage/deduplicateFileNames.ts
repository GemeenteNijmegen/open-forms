import path from 'path';
import { FileData } from './s3PathsFromFileData';


export function deduplicateFileNames(fileData: FileData[]) {
  const paths = new Set(fileData.map(file => file.filename));
  let emptySet = new Set();
  if (paths.size < fileData.length) {
    for (let file of fileData) {
      let counter = 1;
      if (emptySet.has(path)) {
        const ext = path.extname(file.filename);
        const base = file.filename.substring(0, file.filename.length - ext.length);
        while (emptySet.has(`${base}-${counter}${ext}`)) {
          counter++;
        }
        const newName = `${base}-${counter}${ext}`;
        emptySet.add(newName);
        file.filename = newName;
      } else {
        emptySet.add(path);
      }
    }
  }
  return fileData;
}
