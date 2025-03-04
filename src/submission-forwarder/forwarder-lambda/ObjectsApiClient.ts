import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'ObjectsApiClient ' });

interface ObjectsApiClientOptions {
  apikey: string;
}

export class ObjectsApiClient {
  constructor(private readonly options: ObjectsApiClientOptions) { }

  async getObject(url: string): Promise<any> {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Token ${this.options.apikey}`,
        },
      });
      const body = await response.json();
      return body;
    } catch (error) {
      logger.error('Error', { errorDetails: error });
    }
  }

}