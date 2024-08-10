import fs from "fs";
import path from "path";
import { IncomingForm } from "formidable";

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
  const uploadDir = path.join(process.cwd(), "uploads"); // 디렉토리 경로 설정
  // if (!fs.existsSync(uploadDir)) {
  //   fs.mkdirSync(uploadDir, { recursive: true });
  // }

  // 비디오 파일을 저장
  // const filePath = path.join(uploadDir, file.originalFilename);
  // fs.renameSync(file.filepath, filePath);

  return { status: "success", message: "File uploaded successfully!" };
});
