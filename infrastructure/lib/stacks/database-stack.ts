import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
    public readonly conversationsTable: dynamodb.Table;
    public readonly knowledgeBaseTable: dynamodb.Table;
    public readonly analyticsTable: dynamodb.Table;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Tabla de Conversaciones - Historial de chat con TTL
        this.conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
            tableName: 'ChatbotConversations',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Para desarrollo
            timeToLiveAttribute: 'TTL',
            pointInTimeRecovery: false,
        });

        // GSI para buscar por userId
        this.conversationsTable.addGlobalSecondaryIndex({
            indexName: 'UserIdIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // Tabla de Knowledge Base - FAQs y respuestas
        this.knowledgeBaseTable = new dynamodb.Table(this, 'KnowledgeBaseTable', {
            tableName: 'ChatbotKnowledgeBase',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // GSI para búsqueda por keywords
        this.knowledgeBaseTable.addGlobalSecondaryIndex({
            indexName: 'CategoryIndex',
            partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // Tabla de Analytics - Métricas y logs
        this.analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
            tableName: 'ChatbotAnalytics',
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'TTL',
        });

        // GSI para analytics por fecha
        this.analyticsTable.addGlobalSecondaryIndex({
            indexName: 'DateIndex',
            partitionKey: { name: 'metricType', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // Outputs
        new cdk.CfnOutput(this, 'ConversationsTableName', {
            value: this.conversationsTable.tableName,
            exportName: 'ChatbotConversationsTableName',
        });

        new cdk.CfnOutput(this, 'KnowledgeBaseTableName', {
            value: this.knowledgeBaseTable.tableName,
            exportName: 'ChatbotKnowledgeBaseTableName',
        });

        new cdk.CfnOutput(this, 'AnalyticsTableName', {
            value: this.analyticsTable.tableName,
            exportName: 'ChatbotAnalyticsTableName',
        });
    }
}
