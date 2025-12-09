import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface LambdaStackProps extends cdk.StackProps {
    conversationsTable: dynamodb.Table;
    knowledgeBaseTable: dynamodb.Table;
    analyticsTable: dynamodb.Table;
}

export class LambdaStack extends cdk.Stack {
    public readonly orchestratorFunction: lambda.Function;
    public readonly fulfillmentFunction: lambda.Function;

    constructor(scope: Construct, id: string, props: LambdaStackProps) {
        super(scope, id, props);

        // Layer compartido para dependencias Python
        const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/layers/shared')),
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            description: 'Shared dependencies for chatbot lambdas',
        });

        // Rol común con permisos NLP
        const nlpPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'comprehend:DetectSentiment',
                'comprehend:DetectDominantLanguage',
                'translate:TranslateText',
                'lex:RecognizeText',
                'lex:PutSession',
                'lex:GetSession',
                'lex:DeleteSession',
            ],
            resources: ['*'],
        });

        // Lambda Orquestador - Recibe mensajes de WebSocket
        this.orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
            functionName: 'ChatbotOrchestrator',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/handlers/orchestrator')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            layers: [sharedLayer],
            environment: {
                CONVERSATIONS_TABLE: props.conversationsTable.tableName,
                KNOWLEDGE_BASE_TABLE: props.knowledgeBaseTable.tableName,
                ANALYTICS_TABLE: props.analyticsTable.tableName,
                LEX_BOT_ID: cdk.Fn.importValue('ChatbotLexBotId'),
                LEX_BOT_ALIAS_ID: cdk.Fn.importValue('ChatbotLexBotAliasId'),
                LOG_LEVEL: 'INFO',
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        });

        // Lambda Fulfillment - Procesa intents de Lex
        this.fulfillmentFunction = new lambda.Function(this, 'FulfillmentFunction', {
            functionName: 'ChatbotFulfillment',
            runtime: lambda.Runtime.PYTHON_3_11,
            handler: 'handler.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../backend/src/handlers/fulfillment')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            layers: [sharedLayer],
            environment: {
                CONVERSATIONS_TABLE: props.conversationsTable.tableName,
                KNOWLEDGE_BASE_TABLE: props.knowledgeBaseTable.tableName,
                ANALYTICS_TABLE: props.analyticsTable.tableName,
                LOG_LEVEL: 'INFO',
            },
            logRetention: logs.RetentionDays.ONE_WEEK,
        });

        // Permisos para las Lambdas
        this.orchestratorFunction.addToRolePolicy(nlpPolicy);
        this.fulfillmentFunction.addToRolePolicy(nlpPolicy);

        // Permisos DynamoDB
        props.conversationsTable.grantReadWriteData(this.orchestratorFunction);
        props.conversationsTable.grantReadWriteData(this.fulfillmentFunction);
        props.knowledgeBaseTable.grantReadData(this.orchestratorFunction);
        props.knowledgeBaseTable.grantReadData(this.fulfillmentFunction);
        props.analyticsTable.grantWriteData(this.orchestratorFunction);
        props.analyticsTable.grantWriteData(this.fulfillmentFunction);

        // Outputs
        new cdk.CfnOutput(this, 'OrchestratorFunctionArn', {
            value: this.orchestratorFunction.functionArn,
            exportName: 'ChatbotOrchestratorArn',
        });

        new cdk.CfnOutput(this, 'FulfillmentFunctionArn', {
            value: this.fulfillmentFunction.functionArn,
            exportName: 'ChatbotFulfillmentArn',
        });
    }
}
