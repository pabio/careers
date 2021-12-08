/** @typedef { import("./airtable").AirtableRecordResults } AirtableRecordResults */

import got from "got";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const client = new SESClient({
  region: process.env.EMAIL_SES_REGION,
  credentials: {
    accessKeyId: process.env.EMAIL_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.EMAIL_SES_SECRET_ACCESS_KEY,
  },
});

/**
 * Find all applicants on our Airtable that are in the "Out"
 * column, i.e., manually marked as rejected, and send them
 * a rejection email automatically.
 */
const airtableEmail = async () => {
  console.log("Starting Airtable email script");

  // Ensure that API key and table is provided
  if (!AIRTABLE_API_KEY) throw new Error("API key not found");

  /**
   * List of Airtable records
   * @type {AirtableRecordResults}
   */
  const result = await got(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_TABLE_NAME
    )}?maxRecords=100&filterByFormula=${encodeURIComponent(
      // All applicants with the `Status` of "Out"
      "{Status} = 'Out'"
    )}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
  ).json();
  console.log(`Sending ${result.records.length} emails`);

  // Loop through each and send the email
  let i = 0;
  for await (const item of result.records) {
    i++;

    if (
      // Ensure records has a position
      !item.fields.Position ||
      // Ensure record has an email
      !item.fields.Email ||
      // Ensure record has a name
      !item.fields.Name ||
      // Ensure email is valid
      // @link https://stackoverflow.com/a/9204568/1656944
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.fields.Email)
    ) {
      // Move this item to "Emailed out" and update comment
      await got.patch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
          AIRTABLE_TABLE_NAME
        )}/${item.id}`,
        {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
          json: {
            fields: {
              Status: "Emailed out",
              Notes: `${
                item.fields.Notes || ""
              }\n\nPabio Escobar: I didn't find a name, position, or valid email, so I skipped emailing this applicant.`.trim(),
            },
          },
        }
      );

      console.log(`Skipped invalid entry ${i}/${result.records.length}`);
      continue;
    }

    const firstName = `${item.fields.Name.charAt(
      0
    ).toUpperCase()}${item.fields.Name.slice(1).toLowerCase()}`.split(" ")[0];

    // Send email via AWS SES
    await client.send(
      new SendEmailCommand({
        Destination: {
          ToAddresses: [
            // Transform name to title case
            `"${item.fields.Name.trim().replace(
              /\w\S*/g,
              (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            )}" <${item.fields.Email}>`,
          ],
        },
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: `<p>Hi ${firstName},</p>

<p>Thank you for your application to the <strong>${
                item.fields.Position
              }</strong> role at <a href="https://pabio.com?utm_source=recruiting&utm_medium=email&utm_campaign=application_follow_up&utm_content=${encodeURIComponent(
                item.fields.Position.toLowerCase()
                  .replace(/[^\w ]+/g, "")
                  .replace(/ +/g, "_")
              )}&utm_term=${item.id}">Pabio</a>.</p>

<p>We've carefully reviewed your background and experience, and have decided not to proceed with your application at this time.</p>

<p>Thanks again for your application, and we'll keep you in mind for any future openings that may be a better match for your skills and experience.</p>

<p>Best of luck!</p>

<p>Your friends from Pabio (<a href="https://pabio.com?utm_source=recruiting&utm_medium=email&utm_campaign=application_follow_up&utm_content=${encodeURIComponent(
                item.fields.Position.toLowerCase()
                  .replace(/[^\w ]+/g, "")
                  .replace(/ +/g, "_")
              )}&utm_term=${item.id}">https://pabio.com</a>)</p>

<p style="font-size: 80%; color: #999">--</p>

<p style="font-size: 80%; color: #999">You're receiving this email because you applied for the position of ${
                item.fields.Position
              } on ${new Date(item.createdTime).toLocaleDateString()}.</p>
`,
            },
            Text: {
              Charset: "UTF-8",
              Data: `Hi ${firstName},

Thank you for your application to the ${item.fields.Position} role at Pabio.

We've carefully reviewed your background and experience, and have decided not to proceed with your application at this time.

Thanks again for your application, and we'll keep you in mind for any future openings that may be a better match for your skills and experience.

Best of luck!

Your friends from Pabio (https://pabio.com)

--

You're receiving this email because you applied for the position of ${
                item.fields.Position
              } on ${new Date(item.createdTime).toLocaleDateString()}.
`,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: "Following up on your recent application to Pabio",
          },
        },
        Source: "Pabio Careers <careers@mail.pabio.com>",
      })
    );

    // Move this item to "Emailed out"
    await got.patch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}/${item.id}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        json: { fields: { Status: "Emailed out" } },
      }
    );

    console.log(`Sent email ${i}/${result.records.length}`);
  }

  console.log("Completed Airtable email script");
};

airtableEmail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
