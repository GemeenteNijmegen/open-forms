import { esfReportText } from '../esfReportText';
import { submissionReportText } from '../submissionReportText';
import { scenario as eenGewoneDag } from './samples/een-gewone-dag';
import { scenario as meerDagenMetOnvolledigeDag } from './samples/meer-dagen-met-onvolledige-dag';
import { scenario as objectsApiFout } from './samples/objects-api-fout';

// One scenario per file in samples/. A new sample file needs an import and an entry here.
const scenarios = [eenGewoneDag, meerDagenMetOnvolledigeDag, objectsApiFout];

test.each(scenarios)('$description', (scenario) => {
  expect(submissionReportText(scenario.input)).toEqual(scenario.expected.submissionReport);
  expect(esfReportText(scenario.input)).toEqual(scenario.expected.esfReport);
});
