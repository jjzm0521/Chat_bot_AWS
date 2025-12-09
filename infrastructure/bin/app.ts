#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { LambdaStack } from '../lib/stacks/lambda-stack';
import { LexStack } from '../lib/stacks/lex-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();

const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack de base de datos
const databaseStack = new DatabaseStack(app, 'ChatbotDatabaseStack', {
    env,
    description: 'DynamoDB tables for Chatbot knowledge base and conversations',
});

// Stack de almacenamiento
const storageStack = new StorageStack(app, 'ChatbotStorageStack', {
    env,
    description: 'S3 buckets for Chatbot data and assets',
});

// Stack de funciones Lambda
const lambdaStack = new LambdaStack(app, 'ChatbotLambdaStack', {
    env,
    description: 'Lambda functions for Chatbot orchestration and fulfillment',
    conversationsTable: databaseStack.conversationsTable,
    knowledgeBaseTable: databaseStack.knowledgeBaseTable,
    analyticsTable: databaseStack.analyticsTable,
});

// Stack de Amazon Lex
const lexStack = new LexStack(app, 'ChatbotLexStack', {
    env,
    description: 'Amazon Lex v2 Bot configuration',
    fulfillmentLambda: lambdaStack.fulfillmentFunction,
});

// Stack de API Gateway
const apiStack = new ApiStack(app, 'ChatbotApiStack', {
    env,
    description: 'WebSocket API Gateway for Chatbot',
    orchestratorLambda: lambdaStack.orchestratorFunction,
});

// Stack de Frontend
const frontendStack = new FrontendStack(app, 'ChatbotFrontendStack', {
    env,
    description: 'S3 + CloudFront for Chatbot frontend hosting',
    apiEndpoint: apiStack.websocketApiEndpoint,
});

// Tags para todos los recursos
cdk.Tags.of(app).add('Project', 'ChatbotNLP');
cdk.Tags.of(app).add('Environment', 'Development');

app.synth();
