import { SubmissionProcessingMatcher } from '../SubmissionProcessingMatcher';
import { scenario as echteInzendingGeslaagd } from './samples/echte-inzending-geslaagd';
import { scenario as esfTaakOnbekendeStatus } from './samples/esf-taak-onbekende-status';
import { scenario as esfTaakOpenAfgerondVerwerkt } from './samples/esf-taak-open-afgerond-verwerkt';
import { scenario as geenNotificatie } from './samples/geen-notificatie';
import { scenario as logsNietGelezen } from './samples/logs-niet-gelezen';
import { scenario as nieuwePogingNaMislukteStart } from './samples/nieuwe-poging-na-mislukte-start';
import { scenario as ophalenMisluktEenVersie } from './samples/ophalen-mislukt-een-versie';
import { scenario as ophalenMisluktTweeVersies } from './samples/ophalen-mislukt-twee-versies';
import { scenario as stepFunctionGeslaagdNaRedrive } from './samples/step-function-geslaagd-na-redrive';
import { scenario as stepFunctionLooptNog } from './samples/step-function-loopt-nog';
import { scenario as stepFunctionMislukt } from './samples/step-function-mislukt';
import { scenario as tijdvakTeKort } from './samples/tijdvak-te-kort';
import { scenario as traceVanLatereVersie } from './samples/trace-van-latere-versie';

// One scenario per file in samples/, see samples/README.md. A new sample file needs an import and an entry here.
const scenarios = [
  echteInzendingGeslaagd,
  esfTaakOnbekendeStatus,
  esfTaakOpenAfgerondVerwerkt,
  geenNotificatie,
  logsNietGelezen,
  nieuwePogingNaMislukteStart,
  ophalenMisluktEenVersie,
  ophalenMisluktTweeVersies,
  stepFunctionGeslaagdNaRedrive,
  stepFunctionLooptNog,
  stepFunctionMislukt,
  tijdvakTeKort,
  traceVanLatereVersie,
];

describe('SubmissionProcessingMatcher scenarios in test/samples', () => {
  test.each(scenarios)('$description', (scenario) => {
    const outcomes = new SubmissionProcessingMatcher().findOutcomes(scenario.input);
    expect(outcomes).toMatchObject(scenario.expected);
  });
});
