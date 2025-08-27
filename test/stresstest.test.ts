import { createReadStream } from 'fs';
import { createInterface } from 'readline/promises';
import { environmentVariables } from '@gemeentenijmegen/utils';

//Test expects an 'input.csv' on this level, with a csv of this form:
/**
 *
 * dosnr_gws;periodenr;regeling;ink_hef;inleverdatum;klantnr;cli_type_c;ind_recht_uitbet_c;cl_init;cl_voorv;cl_naam;cl_gesl;cl_straat;cl_hnr;cl_hnrtv;cl_pc;cl_pl;cl_gebdat;cl_bsn;p_init;p_voorv;p_naam;draaidatum;e_mail;telefoon;telefoon_mobiel
 * bsn;202412;0;NEE;1-12-2024;12345;client;AB;AB;;Naam1;M;straat1;1;;1234 AB;Nijmegen;1234;1234;;;;1234;test;0612345678;
 */

const objectType = 'https://mijn-services.accp.nijmegen.nl/objecttypes/api/v2/objecttypes/6df21057-e07c-4909-8933-d70b79cfd15e';

const todayYmd = new Date().toISOString().substring(0, 'YYYY-mm-dd'.length);
describe('Stresstesting ESF', () => {
  xtest('Get objects from csv', async () => {
    const sourceData = await bsnAndPeriodFromCsv();
    console.debug(sourceData);
  });

  xtest('Get objects from csv and retrieve objects', async () => {
    const sourceData = await bsnAndPeriodFromCsv();
    const preparedObjectsPromises: any[] = [];
    for (let bsnAndPeriod of sourceData) {
      const bsn = bsnAndPeriod.bsn;
      const input = [
        bsnAndPeriod.bsn,
        bsnAndPeriod.periodenummer,
        Number(bsn.charAt(bsn.length - 1)) % 2 == 1 ? true : false, // inkomstengewijzigd
        Number(bsn.charAt(bsn.length - 2)) % 2 == 1 ? true : false, // woonsituatiegewijzigd
        Number(bsn.charAt(bsn.length - 3)) % 2 == 1 ? true : false, // vakantiegewijzigd
        Number(bsn.charAt(bsn.length - 4)) % 2 == 1 ? true : false, // studiegewijzigd
        Number(bsn.charAt(bsn.length - 5)) % 2 == 1 ? true : false, // vrijwilligerswerkgewijzigd
        Number(bsn.charAt(bsn.length - 6)) % 2 == 1 ? true : false, // vermogengewijzigd
        Number(bsn.charAt(bsn.length - 7)) % 2 == 1 ? true : false, // toelichtingingevuld
        Number(bsn.charAt(bsn.length - 8)) % 2 == 1 ? true : false, // formulierreferentie
      ];
      preparedObjectsPromises.push(preparePatchedObjectData(input));
    }
    const preparedObjects = (await Promise.all(preparedObjectsPromises)).filter(object => object.length);
    console.log(`Processed ${sourceData.length} input records, retrieved ${preparedObjects.length} objects`);
    console.debug(preparedObjects);
  }, 60000);

  xtest('Update objects', async () => {
    const sourceData = await bsnAndPeriodFromCsv();
    const preparedObjectsPromises: any[] = [];
    for (let bsnAndPeriod of sourceData) {
      const bsn = bsnAndPeriod.bsn;
      const input = [
        bsnAndPeriod.bsn,
        bsnAndPeriod.periodenummer,
        Number(bsn.charAt(bsn.length - 1)) % 2 == 1 ? true : false, // inkomstengewijzigd
        Number(bsn.charAt(bsn.length - 2)) % 2 == 1 ? true : false, // woonsituatiegewijzigd
        Number(bsn.charAt(bsn.length - 3)) % 2 == 1 ? true : false, // vakantiegewijzigd
        Number(bsn.charAt(bsn.length - 4)) % 2 == 1 ? true : false, // studiegewijzigd
        Number(bsn.charAt(bsn.length - 5)) % 2 == 1 ? true : false, // vrijwilligerswerkgewijzigd
        Number(bsn.charAt(bsn.length - 6)) % 2 == 1 ? true : false, // vermogengewijzigd
        Number(bsn.charAt(bsn.length - 7)) % 2 == 1 ? true : false, // toelichtingingevuld
        Number(bsn.charAt(bsn.length - 8)) % 2 == 1 ? true : false, // formulierreferentie
      ];
      preparedObjectsPromises.push(preparePatchedObjectData(input));
    }
    const preparedObjects = (await Promise.all(preparedObjectsPromises)).filter(object => object.length).flat();
    console.log(`Processed ${sourceData.length} input records, retrieved ${preparedObjects.length} objects`);
    // console.debug(preparedObjects);
    let i = 0;
    for (let preparedObject of preparedObjects) { // We can also make this parallel
      // if (i < 3) { // TODO remove this when doing full bulk test
      await patchEsfTaak(preparedObject);
      i += 1;
      // }
    }
    console.log('Updated', i, 'objects');

  }, 60000);

});

xtest('Delete objects', async () => {
  const sourceData = await bsnAndPeriodFromCsv();
  const preparedObjectsPromises: any[] = [];
  for (let bsnAndPeriod of sourceData) {
    const bsn = bsnAndPeriod.bsn;
    const input = [
      bsn,
      bsnAndPeriod.periodenummer,
      Number(bsn.charAt(bsn.length - 1)) % 2 == 1 ? true : false, // inkomstengewijzigd
      Number(bsn.charAt(bsn.length - 2)) % 2 == 1 ? true : false, // woonsituatiegewijzigd
      Number(bsn.charAt(bsn.length - 3)) % 2 == 1 ? true : false, // vakantiegewijzigd
      Number(bsn.charAt(bsn.length - 4)) % 2 == 1 ? true : false, // studiegewijzigd
      Number(bsn.charAt(bsn.length - 5)) % 2 == 1 ? true : false, // vrijwilligerswerkgewijzigd
      Number(bsn.charAt(bsn.length - 6)) % 2 == 1 ? true : false, // vermogengewijzigd
      Number(bsn.charAt(bsn.length - 7)) % 2 == 1 ? true : false, // toelichtingingevuld
      Number(bsn.charAt(bsn.length - 8)) % 2 == 1 ? true : false, // formulierreferentie
    ];
    preparedObjectsPromises.push(preparePatchedObjectData(input));
  }
  const preparedObjects = (await Promise.all(preparedObjectsPromises)).filter(object => object.length).flat();
  console.log(`Processed ${sourceData.length} input records, retrieved ${preparedObjects.length} objects`);
  console.debug(preparedObjects);
  let i = 0;
  for (let preparedObject of preparedObjects) {
    // if (i < 3) {
    await deleteEsfTaak(preparedObject);
    i += 1;
    // }
  }
  console.log('Deleted', i, 'objects');
}, 60000);

async function bsnAndPeriodFromCsv() {
  const env = environmentVariables(['ESF_TEST_INPUT_CSV']);
  const rl = createInterface(createReadStream(env.ESF_TEST_INPUT_CSV), process.stdout);
  let firstLine = true;
  let headers: string[] = [];
  let objects: any[] = [];
  for await (const line of rl) {
    if (firstLine) {
      headers = line.replaceAll('"', '').split(';');
      console.debug(headers);
      firstLine = false;
    } else {
      const cols = line.replaceAll('"', '').split(';');
      objects.push({
        bsn: cols[headers.indexOf('cl_bsn')],
        periodenummer: cols[headers.indexOf('periodenr')],
      });
    }
  }
  return objects;
}

async function preparePatchedObjectData(values: any[]) {
  const objectList: any = await fetchEsfTaak(values[0], values[1]);
  let preparedObjects: any[] = [];
  if (objectList.count >= 1) {
    for (let object of objectList.results) {
      const url = object.url;
      preparedObjects.push({
        url,
        uuid: object.uuid,
        bsn: values[0],
        verzonden_data: {
          pdf: 'https://mijn-services.accp.nijmegen.nl/open-zaak/documenten/api/v1/enkelvoudiginformatieobjecten/0729af66-6902-4077-b4b8-6c87a07cef54',
          attachments: [],
          email: object.record.data.formtaak.data.email ?? 'test@example.com',
          telefoon: object.record.data.formtaak.data.telefoon ?? '1234',
          inkomstengewijzigd: values[2] ? 'ja' : 'nee',
          woonsituatiegewijzigd: values[3] ? 'ja' : 'nee',
          vakantiegewijzigd: values[4] ? 'ja' : 'nee',
          studiegewijzigd: values[5] ? 'jaGestartMetStudie' : 'nee',
          vrijwilligerswerkgewijzigd: values[6] ? 'jaGestartMetVrijwilligerswerk' : 'nee',
          vermogengewijzigd: values[7] ? 'ja' : 'nee',
          toelichtingingevuld: values[8] ? 'ja' : 'nee',
          formulierreferentie: `ESF-OF-BULKTEST-${todayYmd}-${object.uuid}`,
        },
      });
    }
  }
  return preparedObjects;
}

async function fetchEsfTaak(bsn: string, periode: string) {
  const env = environmentVariables(['OBJECTS_TOKEN']);
  const result = await fetch(`https://mijn-services.accp.nijmegen.nl/objects/api/v2/objects?type=${objectType}&data_attr=identificatie__value__exact__${bsn}&data_attr=formtaak__data__periodenummer__exact__${periode}&data_attr=status__exact__open`, {
    method: 'GET',
    headers: {
      Authorization: `Token ${env.OBJECTS_TOKEN}`,
    },
  });
  const text = await result.text();
  try {
    const json = JSON.parse(text);
    return json;
  } catch (error) {
    // console.error(error);
    console.error(text);
    return undefined;
  }
}

async function deleteEsfTaak(preparedObject: any) {
  const env = environmentVariables(['OBJECTS_TOKEN']);
  console.log(`Updating ${preparedObject.url} for ${preparedObject.bsn}`);
  try {
    const result = await fetch(preparedObject.url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${env.OBJECTS_TOKEN}`,
        'Content-Crs': 'EPSG:4326',
        'Content-Type': 'application/json',
      },
    });
    const json = await result.json();
    if (result.status >= 400) {
      console.error(`HTTP Error: ${result.status} ${result.statusText} - ${JSON.stringify(json)}`);
    } else {
      console.log(`Updated ${preparedObject.url} for ${preparedObject.bsn}`);
    }
    return json;
  } catch (err) {
    console.error(err);
    return;
  }
}

async function patchEsfTaak(preparedObject: any) {
  const env = environmentVariables(['OBJECTS_TOKEN']);
  console.log(`Updating ${preparedObject.url} for ${preparedObject.bsn}`);
  try {
    const result = await fetch(preparedObject.url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Token ${env.OBJECTS_TOKEN}`,
        'Content-Crs': 'EPSG:4326',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: objectType,
        uuid: preparedObject.uuid,
        record: {
          typeVersion: 6,
          startAt: todayYmd,
          data: {
            status: 'afgerond',
            formtaak: {
              verzonden_data: preparedObject.verzonden_data,
            },
          },
        },
      }),
    });
    const json = await result.json();
    if (result.status >= 400) {
      console.error(`HTTP Error: ${result.status} ${result.statusText} - ${JSON.stringify(json)}`);
    } else {
      console.log(`Updated ${preparedObject.url} for ${preparedObject.bsn}`);
    }
    return json;
  } catch (err) {
    console.error(err);
    return;
  }
}
