import {S3Client, HeadObjectCommand, HeadObjectCommandOutput} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

interface FileDetail {
    keyName: string; // The original name provided by the client
    fileType: string; // MIME type, e.g., 'image/png'
}

interface SignedUploadDetail {
    objectKey: string; // The final S3 key/path
    uploadURL: string; // The unique signed URL for this file
}

class StorageSystem {
    private s3Client: S3Client;
    constructor(s3: S3Client) {
        this.s3Client = s3;
    }               

    public getS3Client(): S3Client {
        return this.s3Client;
    }

    public async getPresignedUrl(
        keyName: string,
    contentType: string,
    expirationInSeconds: number = 300
    ): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: keyName,
            ContentType: contentType
        });

        return getSignedUrl(this.s3Client, command, { expiresIn: expirationInSeconds });
    }

    public async getS3ObjectMetadata(keyName: string): Promise<HeadObjectCommandOutput | null> {
        const command = new HeadObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: keyName,
        });

        try {
            return await this.s3Client.send(command);
        } catch (error: any) {
            if (error.name === 'NotFound') {
                return null;
            }
            console.error("Error fetching S3 object metadata:", error);
            return null;
        }
    }


    public async getDownloadUrl(keyName: string, expirationInSeconds: number = 300): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: keyName,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: expirationInSeconds });
    }


    public async getPresignedUrls(
    fileDetails: FileDetail[],
    expirationInSeconds: number = 600
  ): Promise<SignedUploadDetail[]> {
    const uploadedFiles: SignedUploadDetail[] = [];
    for (const detail of fileDetails) {
      const command = new PutObjectCommand({
        Bucket: process.env.PROCESS_AWS_S3_BUCKET,
        Key: detail.keyName,
        ContentType: detail.fileType,
      });
      const uploadURL = await getSignedUrl(this.s3Client, command, {
        expiresIn: expirationInSeconds,
      });

      uploadedFiles.push({ objectKey: detail.keyName, uploadURL });
    }
    return uploadedFiles;
  }
}


export { StorageSystem };