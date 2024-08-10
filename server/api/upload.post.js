import { IncomingForm } from "formidable";
// To use the File API, use this import path for GoogleAIFileManager.
// Note that this is a different import path than what you use for generating content.
// For versions lower than @google/generative-ai@0.13.0
// use "@google/generative-ai/files"
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";
import { defineEventHandler } from "h3";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

export default defineEventHandler(async (event) => {
  const form = new IncomingForm();

  // promise-based form.parse for file parsing
  const parsedForm = await new Promise((resolve, reject) => {
    form.parse(event.node.req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const file = parsedForm.files.video[0];
  const filePath = file.filepath;

  // Initialize GoogleAIFileManager with your API_KEY.
  const fileManager = new GoogleAIFileManager(process.env.API_KEY);

  // Upload the file and specify a display name.
  const uploadResponse = await fileManager.uploadFile(filePath, {
    mimeType: process.env.MIME_TYPE,
    displayName: process.env.DISPLAY_NAME,
  });

  // Poll getFile() on a set interval (10 seconds here) to check file state.
  let downloadFile = await fileManager.getFile(uploadResponse.file.name);

  while (downloadFile.state === FileState.PROCESSING) {
    process.stdout.write(".");
    // Sleep for 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    // Fetch the file from the API again
    downloadFile = await fileManager.getFile(uploadResponse.file.name);
  }

  const model = genAI.getGenerativeModel({ model: process.env.MODEL });

  const result = await model.generateContent([
    {
      fileData: {
        mimeType: process.env.MIME_TYPE, // Adjust MIME type if needed
        fileUri: uploadResponse.file.uri,
      },
    },
    {
      text: process.env.PROMPT,
    },
  ]);

  return result.response.text();
});
