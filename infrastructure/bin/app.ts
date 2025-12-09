#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// =============================================
// STACK ÚNICO: ChatbotStack
// =============================================
class ChatbotStack extends cdk.Stack {
    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // ================== DynamoDB Tables ==================
        const conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
            tableName: 'ChatbotConversations',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'TTL',
        });

        const knowledgeBaseTable = new dynamodb.Table(this, 'KnowledgeBaseTable', {
            tableName: 'ChatbotKnowledgeBase',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        knowledgeBaseTable.addGlobalSecondaryIndex({
            indexName: 'CategoryIndex',
            partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
        });

        const analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
            tableName: 'ChatbotAnalytics',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'TTL',
        });

        // ================== S3 Bucket ==================
        const dataBucket = new s3.Bucket(this, 'DataBucket', {
            bucketName: `chatbot-data-${this.account}-${this.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
        });

        // ================== Lambda Layer ==================
        const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/layers/shared')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            description: 'Shared dependencies for chatbot lambdas',
        });

        // ================== NLP Policy ==================
        const nlpPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'comprehend:DetectSentiment',
                'comprehend:DetectDominantLanguage',
                'comprehend:DetectEntities',
                'comprehend:DetectKeyPhrases',
                'translate:TranslateText',
                'lex:RecognizeText',
                'lex:PutSession',
                'lex:GetSession',
                'lex:DeleteSession',
            ],
            resources: ['*'],
        });

        // ================== Lambda Functions ==================
        const orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
            functionName: 'ChatbotOrchestrator',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/orchestrator')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            layers: [sharedLayer],
            environment: {
                CONVERSATIONS_TABLE: conversationsTable.tableName,
                KNOWLEDGE_BASE_TABLE: knowledgeBaseTable.tableName,
                ANALYTICS_TABLE: analyticsTable.tableName,
                LEX_BOT_ID: 'PLACEHOLDER',
                LEX_BOT_ALIAS_ID: 'PLACEHOLDER',
                LOG_LEVEL: 'INFO',
            },
        });

        const fulfillmentFunction = new lambda.Function(this, 'FulfillmentFunction', {
            functionName: 'ChatbotFulfillment',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/fulfillment')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            layers: [sharedLayer],
            environment: {
                CONVERSATIONS_TABLE: conversationsTable.tableName,
                KNOWLEDGE_BASE_TABLE: knowledgeBaseTable.tableName,
                ANALYTICS_TABLE: analyticsTable.tableName,
                LOG_LEVEL: 'INFO',
            },
        });

        // Permisos
        orchestratorFunction.addToRolePolicy(nlpPolicy);
        fulfillmentFunction.addToRolePolicy(nlpPolicy);
        conversationsTable.grantReadWriteData(orchestratorFunction);
        conversationsTable.grantReadWriteData(fulfillmentFunction);
        knowledgeBaseTable.grantReadData(orchestratorFunction);
        knowledgeBaseTable.grantReadData(fulfillmentFunction);
        analyticsTable.grantWriteData(orchestratorFunction);
        analyticsTable.grantWriteData(fulfillmentFunction);

        // ================== WebSocket API ==================
        const websocketApi = new apigatewayv2.WebSocketApi(this, 'ChatbotWebSocketApi', {
            apiName: 'ChatbotWebSocketAPI',
            description: 'WebSocket API for Chatbot',
            connectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'ConnectIntegration', orchestratorFunction
                ),
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'DisconnectIntegration', orchestratorFunction
                ),
            },
            defaultRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'DefaultIntegration', orchestratorFunction
                ),
            },
        });

        websocketApi.addRoute('sendMessage', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                'SendMessageIntegration', orchestratorFunction
            ),
        });

        const stage = new apigatewayv2.WebSocketStage(this, 'ProductionStage', {
            webSocketApi: websocketApi,
            stageName: 'production',
            autoDeploy: true,
        });

        // Permiso para API Gateway
        orchestratorFunction.addPermission('WebSocketInvoke', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${websocketApi.apiId}/*`,
        });

        // Permiso para API Gateway Management (enviar respuestas)
        orchestratorFunction.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${websocketApi.apiId}/*`],
        }));

        const websocketEndpoint = `wss://${websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`;

        // ================== Frontend S3 + CloudFront ==================
        const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `chatbot-frontend-${this.account}-${this.region}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        });

        const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
            defaultBehavior: {
                origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        });

        // ================== Outputs ==================
        new cdk.CfnOutput(this, 'WebSocketEndpoint', {
            value: websocketEndpoint,
            description: 'WebSocket API endpoint',
        });

        new cdk.CfnOutput(this, 'FrontendURL', {
            value: `https://${distribution.distributionDomainName}`,
            description: 'CloudFront distribution URL',
        });

        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: frontendBucket.bucketName,
            description: 'S3 bucket for frontend files',
        });

        new cdk.CfnOutput(this, 'OrchestratorFunctionArn', {
            value: orchestratorFunction.functionArn,
        });

        new cdk.CfnOutput(this, 'FulfillmentFunctionArn', {
            value: fulfillmentFunction.functionArn,
        });
    }
}

// Crear el stack
new ChatbotStack(app, 'ChatbotStack', {
    env,
    description: 'Chatbot Inteligente con NLP y Machine Learning',
});

cdk.Tags.of(app).add('Project', 'ChatbotNLP');
cdk.Tags.of(app).add('Environment', 'Development');

app.synth();
