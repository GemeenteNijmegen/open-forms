import { trace } from '../../shared/trace';
import { DocumentLinker } from '../collaborators/DocumentLinker';
import { RolCreator } from '../collaborators/RolCreator';
import { StatusSetter } from '../collaborators/StatusSetter';
import { ZaakCreator } from '../collaborators/ZaakCreator';
import { ZGWHandler } from '../ZGWHandler';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

jest.mock('../CatalogiTypes');
jest.mock('../collaborators/ZaakCreator');
jest.mock('../collaborators/StatusSetter');
jest.mock('../collaborators/RolCreator');
jest.mock('../collaborators/DocumentLinker');
jest.mock('../../shared/trace');

describe('ZGWHandler', () => {
  const mockZakenClient = {} as any;
  const mockCatalogiClient = {} as any;

  const submission: ZGWRegistrationSubmission = {
    reference: 'ABC123',
    zaaktypeIdentificatie: 'ZAAKTYPE123',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call all collaborators in sequence with correct arguments', async () => {
    const zaakUrl = 'http://zaak/created';

    const createZaak = jest.fn().mockResolvedValue(zaakUrl);
    const setFirstStatus = jest.fn().mockResolvedValue(undefined);
    const setInitiatorRol = jest.fn().mockResolvedValue(undefined);
    const linkAllDocuments = jest.fn().mockResolvedValue(undefined);

    (ZaakCreator as jest.Mock).mockImplementation(() => ({ createZaak }));
    (StatusSetter as jest.Mock).mockImplementation(() => ({ setFirstStatus }));
    (RolCreator as jest.Mock).mockImplementation(() => ({ setInitiatorRol }));
    (DocumentLinker as jest.Mock).mockImplementation(() => ({ linkAllDocuments }));

    const handler = new ZGWHandler({
      zakenClient: mockZakenClient,
      catalogiClient: mockCatalogiClient,
    });

    await handler.handle(submission);

    expect(createZaak).toHaveBeenCalledWith(submission);
    expect(setFirstStatus).toHaveBeenCalledWith(submission, zaakUrl);
    expect(setInitiatorRol).toHaveBeenCalledWith(submission, zaakUrl);
    expect(linkAllDocuments).toHaveBeenCalledWith(submission, zaakUrl);
    expect(trace).toHaveBeenCalledWith('ABC123', 'ZGW_REGISTRATION', 'OK');
  });
});
