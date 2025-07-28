import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { StatusSetter, StatusSetterConfig } from '../collaborators/StatusSetter';
import { ZGWRegistrationSubmission } from '../ZGWRegistrationSubmission';

jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');

describe('StatusSetter', () => {
  let mockClient: any;
  let mockLogger: Logger;
  let mockCatalogiTypes: CatalogiTypes;
  let setter: StatusSetter;

  beforeEach(() => {
    mockClient = {} as any;
    mockLogger = new Logger() as any;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();

    mockCatalogiTypes = {
      getFirstStatusType: jest.fn(),
    } as any;

    const config: StatusSetterConfig = {
      zakenClient: mockClient,
      catalogiTypes: mockCatalogiTypes,
      logger: mockLogger,
    };

    setter = new StatusSetter(config);
  });

  it('should call statusCreate when firstStatusType exists', async () => {
    const submission: ZGWRegistrationSubmission = {
      reference: 'REF',
      zaaktypeIdentificatie: 'ZT',
    } as any;

    const mockStatusType = { url: 'http://status/type/1' } as catalogi.StatusType;
    (mockCatalogiTypes.getFirstStatusType as jest.Mock).mockResolvedValue(mockStatusType);

    const mockStatusCreate = jest.fn().mockResolvedValue({
      data: { uuid: 'uuid1', statustoelichting: 'Toelichting' },
    });

    (zaken.Statussen as jest.Mock).mockImplementation(() => ({
      statusCreate: mockStatusCreate,
    }));

    await setter.setFirstStatus(submission, 'http://zaak/url');

    expect(mockCatalogiTypes.getFirstStatusType).toHaveBeenCalledWith('ZT');
    expect(mockStatusCreate).toHaveBeenCalledWith({
      zaak: 'http://zaak/url',
      statustype: 'http://status/type/1',
      datumStatusGezet: expect.any(String),
    });
    expect(mockLogger.debug).toHaveBeenCalledWith('Before statusCreate');
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Created the Status: uuid1'),
    );
  });

  it('should log a warning if no firstStatusType is returned', async () => {
    const submission: ZGWRegistrationSubmission = {
      reference: 'REFX',
      zaaktypeIdentificatie: 'ZTX',
    } as any;

    (mockCatalogiTypes.getFirstStatusType as jest.Mock).mockResolvedValue(undefined);

    await setter.setFirstStatus(submission, 'http://zaak/missing');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No firstStatus set because of an empty statusType for REFX ZTX',
    );
    expect(zaken.Statussen).not.toHaveBeenCalled();
  });
});
