import { s3PathsFromFileData, s3StructuredObjectsFromFileData } from '../s3PathsFromFileData';

const singleFile = [
  {
    data: Buffer.from('test', 'binary'),
    filename: 'test.png',
    format: 'image/png',
  },
];

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

describe('Paths from filedata', () => {
  test('Filedata results in array of s3 strings', async () => {
    const paths = s3PathsFromFileData(singleFile, 'mybucket', 'TDL123.01');
    expect(paths.length).toBe(1);
  });

  test('Paths from filedata handles multiple files', async () => {
    const paths = s3PathsFromFileData(multipleFiles, 'mybucket', 'TDL123.01');
    expect(paths.length).toBe(2);
    expect(paths.find(value => value == 's3://mybucket/TDL123.01/TDL123.01.pdf')).toBeTruthy();
    expect(paths.find(value => value == 's3://mybucket/TDL123.01/attachments/test.png')).toBeTruthy();
  });
});

describe('Structured objects from filedata', () => {
  test('Filedata results in array of objects', async () => {
    const s3Objects = s3StructuredObjectsFromFileData(singleFile, 'mybucket', 'TDL123.01');
    expect(s3Objects.length).toBe(1);
  });

  test('Paths from filedata handles multiple files', async () => {
    const s3Objects = s3StructuredObjectsFromFileData(multipleFiles, 'mybucket', 'TDL123.01');
    expect(s3Objects.length).toBe(2);
    expect(s3Objects.find(value => value.fileName == 'TDL123.01.pdf')).toBeTruthy();
    expect(s3Objects.find(value => value.bucket == 'mybucket')).toBeTruthy();
    expect(s3Objects.find(value => value.objectKey == 'TDL123.01/attachments/test.png')).toBeTruthy();
  });
});
