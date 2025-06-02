import { s3PathsFromFileData } from '../s3PathsFromFileData';

test('Paths from filedata', async() => {
  const filedata = [
    {
      data: Buffer.from('test', 'binary'),
      filename: 'test.png',
      format: 'image/png',
    },
  ];
  const paths = s3PathsFromFileData(filedata, 'mybucket', 'TDL123.01');
  expect(paths.length).toBe(1);
});

test('Paths from filedata handle submission pdf correctly', async() => {
  const filedata = [
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

  const paths = s3PathsFromFileData(filedata, 'mybucket', 'TDL123.01');
  expect(paths.length).toBe(2);
  console.debug(paths);
  expect(paths.find(value => value == 's3://mybucket/TDL123.01/TDL123.01.pdf')).toBeTruthy();
  expect(paths.find(value => value == 's3://mybucket/TDL123.01/attachments/test.png')).toBeTruthy();
});
