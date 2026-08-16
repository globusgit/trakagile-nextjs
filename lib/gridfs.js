import crypto from "crypto";
import mongoose from "mongoose";

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });

export async function uploadToGridFS(buffer, { filename, contentType, metadata = {} }) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, { contentType, metadata: { ...metadata, hash } });
    stream.on("error", reject); stream.on("finish", () => resolve({ id: stream.id, hash })); stream.end(buffer);
  });
}

export async function readFromGridFS(id) {
  const objectId = typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
  const files = await bucket().find({ _id: objectId }).limit(1).toArray();
  if (!files.length) return null;
  const chunks = [];
  await new Promise((resolve, reject) => { const stream = bucket().openDownloadStream(objectId); stream.on("data", (chunk) => chunks.push(chunk)); stream.on("error", reject); stream.on("end", resolve); });
  return { file: files[0], buffer: Buffer.concat(chunks) };
}

export async function deleteFromGridFS(id) {
  if (!id) return;
  try { await bucket().delete(typeof id === "string" ? new mongoose.Types.ObjectId(id) : id); }
  catch (error) { if (error.code !== 26) throw error; }
}
