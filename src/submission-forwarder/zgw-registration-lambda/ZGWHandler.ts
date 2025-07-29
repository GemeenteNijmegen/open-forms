import { Logger } from '@aws-lambda-powertools/logger';
import { HttpClient as CatalogiHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import { HttpClient as ZakenHttpClient } from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from './CatalogiTypes';
import { RolCreator } from './collaborators/RolCreator';
import { StatusSetter } from './collaborators/StatusSetter';
import { ZaakCreator } from './collaborators/ZaakCreator';
import { ZGWRegistrationSubmission } from './ZGWRegistrationSubmission';
import { trace } from '../shared/trace';
import { DocumentLinker } from './collaborators/DocumentLinker';

const HANDLER_ID = 'ZGW_REGISTRATION';
const logger = new Logger();

interface ZGWHandlerOptions {
  zakenClient: ZakenHttpClient;
  catalogiClient: CatalogiHttpClient;
}
export class ZGWHandler {
  constructor(private readonly options: ZGWHandlerOptions) {}
  async handle(submission: ZGWRegistrationSubmission) {
    // Setup logging
    logger.appendKeys({ reference: submission.reference, zaaktype: submission.zaaktypeIdentificatie });
    logger.debug('Start ZGWHandler', { submission }); // Only debug shows entire submission

    // CatalogiTypes instance
    const catalogiTypes = new CatalogiTypes({ catalogiClient: this.options.catalogiClient, logger });

    // Create Zaak and return url
    const zaakUrl = await new ZaakCreator({
      zakenClient: this.options.zakenClient,
      catalogiTypes,
      logger,
    }).createZaak(submission);


    // Set first status
    await new StatusSetter({
      zakenClient: this.options.zakenClient,
      catalogiTypes,
      logger,
    }).setFirstStatus(submission, zaakUrl);

    // Set rol
    await new RolCreator({
      zakenClient: this.options.zakenClient,
      catalogiTypes,
      logger,
    }).setInitiatorRol(submission, zaakUrl);

    // Link documents
    await new DocumentLinker({
      zakenClient: this.options.zakenClient,
      logger,
    }).linkAllDocuments(submission, zaakUrl);

    await trace(submission.reference, HANDLER_ID, 'OK');
  }
}
