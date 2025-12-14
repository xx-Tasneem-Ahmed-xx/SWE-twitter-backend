jest.mock("@/database", () => ({
  media: {
    deleteMany: jest.fn(),
  },
}));

jest.mock("@/application/services/secrets", () => ({
  getKey: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));

import { StorageSystem } from "@/application/services/storeageSystem";
import prisma from "@/database";
import { AppError } from "@/errors/AppError";
import { getKey } from "@/application/services/secrets";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

describe("StorageSystem", () => {
  let mockS3Client: jest.Mocked<S3Client>;
  let storageSystem: StorageSystem;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Client = { send: jest.fn() } as unknown as jest.Mocked<S3Client>;
    (getKey as jest.Mock).mockResolvedValue("test-bucket");
    (getSignedUrl as jest.Mock).mockResolvedValue("signed-url");
    (prisma.media.deleteMany as jest.Mock).mockResolvedValue({});
    storageSystem = new StorageSystem(mockS3Client);
  });

  it("should return the injected s3 client", () => {
    expect(storageSystem.getS3Client()).toBe(mockS3Client);
  });

  it("should create a presigned upload url", async () => {
    (getSignedUrl as jest.Mock).mockResolvedValueOnce("upload-url");
    const url = await storageSystem.getPresignedUrl("file-key", "image/png", 600);

    expect(getKey).toHaveBeenCalledWith("AWS_S3_BUCKET");
    expect(getSignedUrl).toHaveBeenCalledWith(
      mockS3Client,
      expect.any(PutObjectCommand),
      { expiresIn: 600 }
    );
    expect(url).toBe("upload-url");
  });

  it("should fetch existing object metadata", async () => {
    (mockS3Client.send as jest.Mock).mockResolvedValue({ ContentLength: 10 });

    const result = await storageSystem.getS3ObjectMetadata("file-key");

    expect(getKey).toHaveBeenCalledWith("AWS_S3_BUCKET");
    expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    expect(result?.ContentLength).toBe(10);
  });

  it("should return null when object metadata is not found", async () => {
    (mockS3Client.send as jest.Mock).mockRejectedValue({ name: "NotFound" });

    const result = await storageSystem.getS3ObjectMetadata("missing-key");

    expect(result).toBeNull();
  });

  it("should return null and log on unexpected metadata errors", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    (mockS3Client.send as jest.Mock).mockRejectedValue({ name: "Timeout" });

    const result = await storageSystem.getS3ObjectMetadata("file-key");

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should generate a download url when media exists", async () => {
    const mockMetadata = { ContentLength: 1 } as unknown as HeadObjectCommandOutput;
    jest.spyOn(storageSystem, "getS3ObjectMetadata").mockResolvedValue(mockMetadata);
    (getSignedUrl as jest.Mock).mockResolvedValueOnce("download-url");

    const url = await storageSystem.getDownloadUrl("file-key", 1200);

    expect(getSignedUrl).toHaveBeenCalledWith(
      mockS3Client,
      expect.any(GetObjectCommand),
      { expiresIn: 1200 }
    );
    expect(prisma.media.deleteMany).not.toHaveBeenCalled();
    expect(url).toBe("download-url");
  });

  it("should delete database record and throw when media is missing", async () => {
    jest.spyOn(storageSystem, "getS3ObjectMetadata").mockResolvedValue(null);

    const promise = storageSystem.getDownloadUrl("missing-key");

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      message: "media not found on s3",
      statusCode: 404,
    });
    expect(prisma.media.deleteMany).toHaveBeenCalledWith({ where: { keyName: "missing-key" } });
  });

  it("should create presigned urls for multiple files", async () => {
    (getSignedUrl as jest.Mock)
      .mockResolvedValueOnce("url-1")
      .mockResolvedValueOnce("url-2");

    const result = await storageSystem.getPresignedUrls(
      [
        { keyName: "file-1", fileType: "image/png" },
        { keyName: "file-2", fileType: "image/jpeg" },
      ],
      900
    );

    expect(getSignedUrl).toHaveBeenCalledTimes(2);
    expect(getSignedUrl).toHaveBeenNthCalledWith(
      1,
      mockS3Client,
      expect.any(PutObjectCommand),
      { expiresIn: 900 }
    );
    expect(getSignedUrl).toHaveBeenNthCalledWith(
      2,
      mockS3Client,
      expect.any(PutObjectCommand),
      { expiresIn: 900 }
    );
    expect(result).toEqual([
      { objectKey: "file-1", uploadURL: "url-1" },
      { objectKey: "file-2", uploadURL: "url-2" },
    ]);
  });

  it("should delete media from s3", async () => {
    (mockS3Client.send as jest.Mock).mockResolvedValue({ ok: true });

    const response = await storageSystem.dropS3Media("file-key");

    expect(getKey).toHaveBeenCalledWith("AWS_S3_BUCKET");
    expect(mockS3Client.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    expect(response).toEqual({ ok: true });
  });

  it("should propagate errors when deleting media fails", async () => {
    (mockS3Client.send as jest.Mock).mockRejectedValue(new Error("delete failed"));

    await expect(storageSystem.dropS3Media("file-key")).rejects.toThrow("delete failed");
  });
});
