import { deduplicateFileNames } from '../deduplicateFileNames';

test('Deduplicate filenames', async() => {
  const filedata = [
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'application/pdf',
    },
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'image/png',
    },
  ];
  const deduplicated = deduplicateFileNames(filedata);
  console.debug(deduplicated);
  expect(deduplicated.find(file => file.filename == 'TDL123.01-1.pdf')).toBeTruthy();
});

test('Deduplicate filenames with multiple duplicates', async() => {
  const filedata = [
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'application/pdf',
    },
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'image/png',
    },
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'image/png',
    },
  ];
  const deduplicated = deduplicateFileNames(filedata);
  expect(deduplicated.find(file => file.filename == 'TDL123.01-1.pdf')).toBeTruthy();
  expect(deduplicated.find(file => file.filename == 'TDL123.01-2.pdf')).toBeTruthy();
});

test('Deduplicate filenames without duplicates should return identical set', async() => {
  const filedata = [
    {
      data: null as unknown as Buffer,
      filename: 'TDL123.01.pdf',
      format: 'application/pdf',
    },
    {
      data: null as unknown as Buffer,
      filename: 'somefile.pdf',
      format: 'image/png',
    },
  ];
  const original = structuredClone(filedata);
  const deduplicated = deduplicateFileNames(filedata);
  console.debug(deduplicated);
  expect(deduplicated).toEqual(original);
});
