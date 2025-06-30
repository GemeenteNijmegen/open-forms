import { Logger } from "@aws-lambda-powertools/logger";
import path from "path";
import fs from "fs";
/**
 * Publishes Mock Responses to the SNS Topic until the real trasnformation is implemented.
 * All handled in one class to make it easy to replace and delete
 */

export class MockVIPHandler {
  private readonly logger = new Logger({ serviceName: "MockVIPHandler" });
  private readonly mockDir = path.join(__dirname, "../mockMessages");

  constructor() {
    this.logger.info("MockVIPHandler initialized – serving static mock files");
  }

  /**
   * Load and return the mock JSON payload for the given choice.
   * Falls back to '01' if the requested file does not exist or fails to parse.
   */
  public handle(choice: string): any {
    this.logger.info("Start mock handler");
    const fileName = `sns-submission-${choice}.json`;
    const filePath = path.join(this.mockDir, fileName);

    try {
      this.logger.debug(`Attempting to load mock file`, { filePath });
      const raw = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(raw);
      this.logger.info(json);
      this.logger.info(`Loaded mock file ${fileName} successfully`);
      return json;
    } catch (err) {
      this.logger.warn(
        `Failed to load mock file ${fileName}, falling back to '01'`,
        { error: err }
      );
      // fallback
      return backupMock;
    }
  }
}

export const backupMock = {
  reference: "OF-D4CRFR",
  fileObjects: [
    {
      bucket: "open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu",
      objectKey: "jz4all/OF-D4CRFR/OF-D4CRFR.pdf",
      fileName: "OF-D4CRFR.pdf",
      objectType: "submission",
    },
    {
      bucket: "open-forms-main-stack-submissionforwardersubmissio-zwnxg2nji9fu",
      objectKey: "jz4all/OF-D4CRFR/bijlage_een.jpg",
      fileName: "bijlage_een.jpg",
      objectType: "attachment",
    },
  ],
  data: {
    isgemachtigde: "",
    naamIngelogdeGebruiker: "Local Funzoom N.V.",
    inlogmiddel: "eherkenning",
    vipZaaktype: "7562e893-3d95-4114-bceb-b3407346e4ff",
    opWelkeDatumHeeftDeGemeenteHetBesluitBekendGemaaktOfDeBeschikkingGegeven:
      "21-06-2025",
    welkKenmerkOfReferentienummerHeeftHetBesluitOfDeBeschikkingWaartegenUBezwaarMaakt:
      "weewrwer",
    eMailadres: "testexample@nijmegen.nl",
    telefoonnummer: "061234567890",
  },
  kvknummer: "90004760",
};
