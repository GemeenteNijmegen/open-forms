import { Logger } from '@aws-lambda-powertools/logger';
import * as catalogi from '@gemeentenijmegen/modules-zgw-client/lib/catalogi-generated-client';
import * as zaken from '@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client';
import { CatalogiTypes } from '../CatalogiTypes';
import { StatusSetter, StatusSetterConfig } from '../collaborators/StatusSetter';
import { zgwToday } from '../collaborators/Utils';

jest.mock('@gemeentenijmegen/modules-zgw-client/lib/zaken-generated-client');

describe('StatusSetter', () => {
  let mockClient: any;
  let mockLogger: Logger;
  let mockCatalogiTypes: Partial<CatalogiTypes>;
  let setter: StatusSetter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {} as any;
    mockLogger = new Logger() as any;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.info = jest.fn();

    mockCatalogiTypes = {
      getFirstStatusType: jest.fn(),
    };
    const config: StatusSetterConfig = {
      zakenClient: mockClient,
      catalogiTypes: mockCatalogiTypes as CatalogiTypes,
      logger: mockLogger,
    };
    setter = new StatusSetter(config);
  });

  it('should call statusCreate when firstStatusType exists and none set yet', async () => {
    const submission = { reference: 'REF', zaaktypeIdentificatie: 'ZT' } as any;
    const mockStatusType = { url: 'http://status/type/1' } as catalogi.StatusType;
    (mockCatalogiTypes.getFirstStatusType as jest.Mock).mockResolvedValue(mockStatusType);

    const mockStatusList = jest.fn().mockResolvedValue({ data: { count: 0, results: [] } });
    const mockStatusCreate = jest.fn().mockResolvedValue({
      data: { uuid: 'uuid1', statustoelichting: 'Toelichting' },
    });
    (zaken.Statussen as jest.Mock).mockImplementation(() => ({
      statusList: mockStatusList,
      statusCreate: mockStatusCreate,
    }));

    await setter.setFirstStatus(submission, 'http://zaak/url');

    expect(mockCatalogiTypes.getFirstStatusType).toHaveBeenCalledWith('ZT');
    expect(mockStatusList).toHaveBeenCalledWith({ statustype: 'http://status/type/1', zaak: 'http://zaak/url' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Before statusCreate');
    expect(mockStatusCreate).toHaveBeenCalledWith({
      zaak: 'http://zaak/url',
      statustype: 'http://status/type/1',
      datumStatusGezet: zgwToday,
    });
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Created the Status: uuid1'));
  });

  it('should log info and not create when status already exists', async () => {
    const submission = { reference: 'REFX', zaaktypeIdentificatie: 'ZTX' } as any;
    const mockStatusType = { url: 'http://status/type/2' } as catalogi.StatusType;
    (mockCatalogiTypes.getFirstStatusType as jest.Mock).mockResolvedValue(mockStatusType);

    const mockStatusList = jest.fn().mockResolvedValue({
      data: { count: 1, results: [{ uuid: 'ex-uuid', statustoelichting: 'exists' }] },
    });
    const mockStatusCreate = jest.fn();
    (zaken.Statussen as jest.Mock).mockImplementation(() => ({
      statusList: mockStatusList,
      statusCreate: mockStatusCreate,
    }));

    await setter.setFirstStatus(submission, 'http://zaak/exist');

    expect(mockStatusList).toHaveBeenCalledWith({ statustype: 'http://status/type/2', zaak: 'http://zaak/exist' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Status was already set. Do not set again ',
      { results: { uuid: 'ex-uuid', statustoelichting: 'exists' } },
    );
    expect(mockStatusCreate).not.toHaveBeenCalled();
  });

  it('should warn when no firstStatusType is returned', async () => {
    const submission = { reference: 'REFY', zaaktypeIdentificatie: 'ZTY' } as any;
    (mockCatalogiTypes.getFirstStatusType as jest.Mock).mockResolvedValue(undefined);

    await setter.setFirstStatus(submission, 'http://zaak/no-type');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No firstStatus set because of an empty statusType for REFY ZTY',
    );
    expect(zaken.Statussen).not.toHaveBeenCalled();
  });
});
