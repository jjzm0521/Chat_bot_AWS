import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
    public readonly dataBucket: s3.Bucket;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Bucket para datos y assets del chatbot
        this.dataBucket = new s3.Bucket(this, 'ChatbotDataBucket', {
            bucketName: `chatbot-data-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            cors: [
                {
                    allowedMethods: [s3.HttpMethods.GET],
                    allowedOrigins: ['*'],
                    allowedHeaders: ['*'],
                },
            ],
        });

        // Outputs
        new cdk.CfnOutput(this, 'DataBucketName', {
            value: this.dataBucket.bucketName,
            exportName: 'ChatbotDataBucketName',
        });

        new cdk.CfnOutput(this, 'DataBucketArn', {
            value: this.dataBucket.bucketArn,
            exportName: 'ChatbotDataBucketArn',
        });
    }
}
