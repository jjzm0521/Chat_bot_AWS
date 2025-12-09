import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'path';

interface FrontendStackProps extends cdk.StackProps {
    apiEndpoint: string;
}

export class FrontendStack extends cdk.Stack {
    public readonly distribution: cloudfront.Distribution;
    public readonly websiteUrl: string;

    constructor(scope: Construct, id: string, props: FrontendStackProps) {
        super(scope, id, props);

        // Bucket para el frontend
        const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            bucketName: `chatbot-frontend-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        // Origin Access Identity para CloudFront
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
            comment: 'OAI for Chatbot frontend',
        });

        // Permitir acceso a CloudFront
        websiteBucket.grantRead(originAccessIdentity);

        // Distribución CloudFront
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket, {
                    originAccessIdentity,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
            ],
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            comment: 'Chatbot NLP Frontend Distribution',
        });

        // Deploy del frontend (si existe el build)
        try {
            new s3deploy.BucketDeployment(this, 'DeployWebsite', {
                sources: [s3deploy.Source.asset(path.join(__dirname, '../../../frontend/dist'))],
                destinationBucket: websiteBucket,
                distribution: this.distribution,
                distributionPaths: ['/*'],
            });
        } catch {
            // Frontend no compilado aún, se ignora
            console.log('Frontend not built yet, skipping deployment');
        }

        this.websiteUrl = `https://${this.distribution.distributionDomainName}`;

        // Outputs
        new cdk.CfnOutput(this, 'WebsiteBucketName', {
            value: websiteBucket.bucketName,
            exportName: 'ChatbotFrontendBucket',
        });

        new cdk.CfnOutput(this, 'DistributionId', {
            value: this.distribution.distributionId,
            exportName: 'ChatbotDistributionId',
        });

        new cdk.CfnOutput(this, 'WebsiteURL', {
            value: this.websiteUrl,
            description: 'URL del frontend del chatbot',
            exportName: 'ChatbotWebsiteURL',
        });

        new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
            value: props.apiEndpoint,
            description: 'WebSocket API endpoint para configurar en el frontend',
        });
    }
}
