import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface Application {
  url: string;
  includeParams: boolean;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

  try {
    const promises = applications.map(application => callApplication(event, application));
    await Promise.all(promises);
  } catch (error) {
    console.log(error);
  }

  return {
    statusCode: 200,
    body: '',
  }

}

async function callApplication(event: APIGatewayProxyEvent, application: Application) {

  const paramVar = event.pathParameters?.paramvar;
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
  url = url.replace('<PARAMVAR>', paramVar ?? 'notfound');


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