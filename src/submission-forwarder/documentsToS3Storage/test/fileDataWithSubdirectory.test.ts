import { addSubdirctoriesToFileData } from "../addSubdirectoriesToFileData";

const multipleFiles = [
  {
    data: Buffer.from('test', 'binary'),
    filename: 'TDL123.01.pdf',
    format: 'application/pdf',
  },
  {
    data: Buffer.from('test', 'binary'),
    filename: 'attachments/test.png',
    format: 'image/png',
  },
];

test('subdirectory added to filedata', () => {
  const data = addSubdirctoriesToFileData(multipleFiles, 'subdir');
  expect(data[0].filename).toBe('subdir/TDL123.01.pdf');
  expect(data[1].filename).toBe('subdir/attachments/test.png');
});