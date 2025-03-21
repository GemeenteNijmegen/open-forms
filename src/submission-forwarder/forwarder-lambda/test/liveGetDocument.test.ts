import { documenten } from '@gemeentenijmegen/modules-zgw-client';
import { HttpClient as DocumentenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/documenten-generated-client';
import { writeFileSync } from 'fs';
import * as jwt from 'jsonwebtoken';


const runLiveTests = process.env.LIVE_GET_DOCUMENT_TESTS === 'true' ? describe : describe.skip;

runLiveTests('Live get document tests', () => {

  test('Live get document', async () => {

    const uuid = 'c6d3e82c-190e-49cb-b4a6-6ff7e0109af5';
    const httpClient = getDocumentenClient(process.env.LIVE_GET_DOCUMENT_TESTS_BASE_URL!);
    const documentenClient = new documenten.Enkelvoudiginformatieobjecten(httpClient);
    const data = await documentenClient.enkelvoudiginformatieobjectDownload({ uuid }, {
      responseEncoding: 'binary',
    });
    console.log('File downloaded... writing to disk');

    const file = data.data as any; // It is NOT a File/Blob but in reality its a string?
    console.log(typeof file); // Should be 'object' is 'string'

    const buffer = Buffer.from(file, 'binary');
    writeFileSync('test.pdf', buffer);

  });

});


function getDocumentenClient(baseUrl: string) {
  const token = createToken();
  const client = new DocumentenHttpClient({
    baseURL: baseUrl,
    format: 'json',
    async securityWorker(securityData: any) {
      return {
        headers: {
          Authorization: `Bearer ${securityData?.token}`,
        },
      };
    },
  });
  client.setSecurityData({ token });
  return client;
}

function createToken(): string {
  const clientId = process.env.LIVE_GET_DOCUMENT_TESTS_CLIENT_ID!;
  const clientSecret = process.env.LIVE_GET_DOCUMENT_TESTS_CLIENT_SECRET!;
  return jwt.sign(
    {
      iss: clientId,
      iat: Math.floor(Date.now() / 1000),
      client_id: clientId,
      user_id: clientId,
      user_representation: clientId,
    },
    clientSecret,
    { expiresIn: '12h' }, // Set token expiration to 12 hours
  );
}