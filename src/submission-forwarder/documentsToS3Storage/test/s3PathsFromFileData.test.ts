import { s3PathsFromFileData } from "../s3PathsFromFileData";

test('Paths from filedata', async() => {
  const filedata = [
    {
      data: Buffer.from('test', 'binary'),
      filename: 'test.png',
      format: 'image/png'
    }
  ];
  const paths = s3PathsFromFileData(filedata, 'mybucket', 'TDL123.01');
  expect(paths.length).toBe(1);
});

test('Paths from filedata handle submission pdf correctly', async() => {
  const filedata = [
    {
      data: Buffer.from('test', 'binary'),
      filename: 'submission.pdf',
      format: 'application/pdf'
    },
    {
      data: Buffer.from('test', 'binary'),
      filename: 'test.png',
      format: 'image/png'
    }
  ];

  const paths = s3PathsFromFileData(filedata, 'mybucket', 'TDL123.01');
  expect(paths.length).toBe(2);
  expect(paths[paths.length]).toBe('s3://mybucket/TDL123.01/TDL123.01.pdf')
});
