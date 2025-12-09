import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
    orchestratorLambda: lambda.Function;
}

export class ApiStack extends cdk.Stack {
    public readonly websocketApi: apigatewayv2.WebSocketApi;
    public readonly websocketApiEndpoint: string;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        // WebSocket API
        this.websocketApi = new apigatewayv2.WebSocketApi(this, 'ChatbotWebSocketApi', {
            apiName: 'ChatbotWebSocketAPI',
            description: 'WebSocket API for Chatbot real-time communication',
            connectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'ConnectIntegration',
                    props.orchestratorLambda
                ),
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'DisconnectIntegration',
                    props.orchestratorLambda
                ),
            },
            defaultRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                    'DefaultIntegration',
                    props.orchestratorLambda
                ),
            },
        });

        // Ruta personalizada para mensajes
        this.websocketApi.addRoute('sendMessage', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
                'SendMessageIntegration',
                props.orchestratorLambda
            ),
        });

        // Stage de producción
        const stage = new apigatewayv2.WebSocketStage(this, 'ProductionStage', {
            webSocketApi: this.websocketApi,
            stageName: 'production',
            autoDeploy: true,
        });

        // Permiso para que API Gateway invoque Lambda
        props.orchestratorLambda.addPermission('WebSocketInvoke', {
            principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/*`,
        });

        // Endpoint del WebSocket
        this.websocketApiEndpoint = `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`;

        // Outputs
        new cdk.CfnOutput(this, 'WebSocketApiId', {
            value: this.websocketApi.apiId,
            exportName: 'ChatbotWebSocketApiId',
        });

        new cdk.CfnOutput(this, 'WebSocketEndpoint', {
            value: this.websocketApiEndpoint,
            exportName: 'ChatbotWebSocketEndpoint',
        });

        new cdk.CfnOutput(this, 'WebSocketConnectUrl', {
            value: `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage.stageName}`,
            description: 'WebSocket connection URL',
        });
    }
}
