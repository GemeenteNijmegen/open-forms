import { ConfigurationError } from '../../errors/ErrorTypes';
import { TribeSubmissionProcessor } from '../../support/TribeSubmissionProcessor.type';
import { ProcessorRegistry } from '../ProcessorRegistry';

const fakeProcessor: TribeSubmissionProcessor = {
  process: jest.fn().mockResolvedValue({ status: 'ok' }),
};

describe('ProcessorRegistry', () => {
  test('selects the registered processor for a known combination', () => {
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', fakeProcessor);
    expect(registry.select('AUTODELEN', 'AUTODELEN_AANMELDING')).toBe(fakeProcessor);
  });

  test('throws a ConfigurationError for an unregistered environment', () => {
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', fakeProcessor);
    expect(() => registry.select('ENERGIELOKET', 'ENERGIELOKET_INWONER')).toThrow(ConfigurationError);
  });

  test('throws a ConfigurationError for a known environment with an unregistered submissiontype', () => {
    const registry = new ProcessorRegistry();
    registry.register('AUTODELEN', 'AUTODELEN_AANMELDING', fakeProcessor);
    expect(() => registry.select('AUTODELEN', 'SOME_OTHER_TYPE')).toThrow(ConfigurationError);
  });

  test('never falls back to any default processor', () => {
    const registry = new ProcessorRegistry();
    expect(() => registry.select('AUTODELEN', 'AUTODELEN_AANMELDING')).toThrow(ConfigurationError);
  });
});
