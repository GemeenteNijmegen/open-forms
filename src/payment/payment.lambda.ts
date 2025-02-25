import { APIGatewayProxyEvent } from 'aws-lambda';

interface Application {
  url: string;
  includeParams: boolean;
}

export async function handler(event: APIGatewayProxyEvent) {
  console.log(JSON.stringify(event, null, 4));

  // const targetUrlsString = process.env.TARGET_PAYMENT_URLS!;
  // const urls = targetUrlsString.split(';');

  const applications = [
    {
      url: 'https://formulier.accp.nijmegen.nl/payment/ogone-legacy/webhook',
      includeParams: true,
    },
    {
      url: 'https://app6-accp.nijmegen.nl/form/submission/postsale/<PARAMVAR>',
      includeParams: false,
    },
  ];

  const promises = applications.map(application => callApplication(event, application));
  await Promise.all(promises);

}

async function callApplication(event: APIGatewayProxyEvent, application: Application) {

  const paramVar = event.queryStringParameters?.paramvar;
  let params = new URLSearchParams();
  let headers = {};

  if (event.queryStringParameters) {
    params = new URLSearchParams(event.queryStringParameters as Record<string, string>);
  }

  if (event.headers) {
    headers = event.headers as Record<string, string>;
  }

  let url = application.url;
  if (application.includeParams) {
    url += `?${params.toString()}`;
  }
  if (application.url.includes('<PARAMVAR>')) {
    url.replace('<PARAMVAR>', paramVar ?? 'notfound');
  }

  console.log('Forwarding to url:', url);
  return fetch(url, {
    method: 'POST',
    body: getBody(event),
    headers: headers,
  });

}


function getBody(event: APIGatewayProxyEvent) {
  if (event.isBase64Encoded) {
    return Buffer.from(event.body ?? '').toString('utf-8');
  }
  return event.body;
}