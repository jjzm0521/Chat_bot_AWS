import * as cdk from 'aws-cdk-lib';
import * as lex from 'aws-cdk-lib/aws-lex';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface LexStackProps extends cdk.StackProps {
    fulfillmentLambda: lambda.Function;
}

export class LexStack extends cdk.Stack {
    public readonly botId: string;
    public readonly botAliasId: string;

    constructor(scope: Construct, id: string, props: LexStackProps) {
        super(scope, id, props);

        // Rol para Lex Bot
        const lexRole = new iam.Role(this, 'LexBotRole', {
            assumedBy: new iam.ServicePrincipal('lexv2.amazonaws.com'),
            description: 'Role for Chatbot Lex Bot',
        });

        lexRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'polly:SynthesizeSpeech',
                'comprehend:DetectSentiment',
            ],
            resources: ['*'],
        }));

        // Permiso para que Lex invoque Lambda
        props.fulfillmentLambda.addPermission('LexInvoke', {
            principal: new iam.ServicePrincipal('lexv2.amazonaws.com'),
            action: 'lambda:InvokeFunction',
        });

        // Definición del Bot Lex v2
        const bot = new lex.CfnBot(this, 'ChatbotNLPBot', {
            name: 'ChatbotNLP',
            description: 'Chatbot inteligente con NLP y Machine Learning',
            roleArn: lexRole.roleArn,
            dataPrivacy: {
                ChildDirected: false,
            },
            idleSessionTtlInSeconds: 300,
            autoBuildBotLocales: true,
            botLocales: [
                // Locale Español
                {
                    localeId: 'es_ES',
                    nluConfidenceThreshold: 0.4,
                    voiceSettings: {
                        voiceId: 'Lucia',
                    },
                    intents: this.getIntentsForLocale('es'),
                    slotTypes: this.getSlotTypes('es'),
                },
                // Locale Inglés
                {
                    localeId: 'en_US',
                    nluConfidenceThreshold: 0.4,
                    voiceSettings: {
                        voiceId: 'Joanna',
                    },
                    intents: this.getIntentsForLocale('en'),
                    slotTypes: this.getSlotTypes('en'),
                },
                // Locale Portugués
                {
                    localeId: 'pt_BR',
                    nluConfidenceThreshold: 0.4,
                    voiceSettings: {
                        voiceId: 'Camila',
                    },
                    intents: this.getIntentsForLocale('pt'),
                    slotTypes: this.getSlotTypes('pt'),
                },
            ],
        });

        // Bot Version
        const botVersion = new lex.CfnBotVersion(this, 'ChatbotVersion', {
            botId: bot.attrId,
            botVersionLocaleSpecification: [
                { localeId: 'es_ES', botVersionLocaleDetails: { sourceBotVersion: 'DRAFT' } },
                { localeId: 'en_US', botVersionLocaleDetails: { sourceBotVersion: 'DRAFT' } },
                { localeId: 'pt_BR', botVersionLocaleDetails: { sourceBotVersion: 'DRAFT' } },
            ],
        });

        // Bot Alias
        const botAlias = new lex.CfnBotAlias(this, 'ChatbotAlias', {
            botId: bot.attrId,
            botAliasName: 'Production',
            botVersion: botVersion.attrBotVersion,
            botAliasLocaleSettings: [
                {
                    localeId: 'es_ES',
                    botAliasLocaleSetting: {
                        enabled: true,
                        codeHookSpecification: {
                            lambdaCodeHook: {
                                lambdaArn: props.fulfillmentLambda.functionArn,
                                codeHookInterfaceVersion: '1.0',
                            },
                        },
                    },
                },
                {
                    localeId: 'en_US',
                    botAliasLocaleSetting: {
                        enabled: true,
                        codeHookSpecification: {
                            lambdaCodeHook: {
                                lambdaArn: props.fulfillmentLambda.functionArn,
                                codeHookInterfaceVersion: '1.0',
                            },
                        },
                    },
                },
                {
                    localeId: 'pt_BR',
                    botAliasLocaleSetting: {
                        enabled: true,
                        codeHookSpecification: {
                            lambdaCodeHook: {
                                lambdaArn: props.fulfillmentLambda.functionArn,
                                codeHookInterfaceVersion: '1.0',
                            },
                        },
                    },
                },
            ],
        });

        this.botId = bot.attrId;
        this.botAliasId = botAlias.attrBotAliasId;

        // Outputs
        new cdk.CfnOutput(this, 'LexBotId', {
            value: bot.attrId,
            exportName: 'ChatbotLexBotId',
        });

        new cdk.CfnOutput(this, 'LexBotAliasId', {
            value: botAlias.attrBotAliasId,
            exportName: 'ChatbotLexBotAliasId',
        });
    }

    private getSlotTypes(lang: string): lex.CfnBot.SlotTypeProperty[] {
        const ratings = ['1', '2', '3', '4', '5'];
        const topics: Record<string, string[]> = {
            es: ['precio', 'envío', 'devolución', 'garantía', 'horario', 'ubicación', 'contacto'],
            en: ['price', 'shipping', 'return', 'warranty', 'hours', 'location', 'contact'],
            pt: ['preço', 'envio', 'devolução', 'garantia', 'horário', 'localização', 'contato'],
        };

        return [
            {
                name: 'RatingType',
                description: 'Rating from 1 to 5',
                valueSelectionSetting: {
                    resolutionStrategy: 'ORIGINAL_VALUE',
                },
                slotTypeValues: ratings.map(r => ({
                    sampleValue: { value: r },
                })),
            },
            {
                name: 'TopicType',
                description: 'FAQ topics',
                valueSelectionSetting: {
                    resolutionStrategy: 'TOP_RESOLUTION',
                },
                slotTypeValues: topics[lang].map(t => ({
                    sampleValue: { value: t },
                })),
            },
        ];
    }

    private getIntentsForLocale(lang: string): lex.CfnBot.IntentProperty[] {
        const messages: Record<string, Record<string, string>> = {
            greeting: {
                es: '¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?',
                en: 'Hello! I am your virtual assistant. How can I help you today?',
                pt: 'Olá! Sou seu assistente virtual. Como posso ajudá-lo hoje?',
            },
            farewell: {
                es: '¡Hasta luego! Fue un placer ayudarte.',
                en: 'Goodbye! It was a pleasure helping you.',
                pt: 'Até logo! Foi um prazer ajudá-lo.',
            },
            help: {
                es: 'Puedo ayudarte con consultas sobre precios, envíos, devoluciones y más. ¿Qué necesitas saber?',
                en: 'I can help you with inquiries about prices, shipping, returns and more. What do you need to know?',
                pt: 'Posso ajudá-lo com perguntas sobre preços, envios, devoluções e mais. O que você precisa saber?',
            },
            fallback: {
                es: 'Lo siento, no entendí tu pregunta. ¿Podrías reformularla?',
                en: 'Sorry, I did not understand your question. Could you rephrase it?',
                pt: 'Desculpe, não entendi sua pergunta. Poderia reformulá-la?',
            },
            faqPrompt: {
                es: '¿Sobre qué tema te gustaría saber?',
                en: 'What topic would you like to know about?',
                pt: 'Sobre qual tema você gostaria de saber?',
            },
            feedbackPrompt: {
                es: '¿Cómo calificarías tu experiencia del 1 al 5?',
                en: 'How would you rate your experience from 1 to 5?',
                pt: 'Como você classificaria sua experiência de 1 a 5?',
            },
            feedbackThanks: {
                es: '¡Gracias por tu retroalimentación!',
                en: 'Thank you for your feedback!',
                pt: 'Obrigado pelo seu feedback!',
            },
        };

        const utterances: Record<string, Record<string, string[]>> = {
            greeting: {
                es: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'qué tal', 'hey'],
                en: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening', 'hey'],
                pt: ['olá', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'e aí'],
            },
            farewell: {
                es: ['adiós', 'hasta luego', 'chao', 'nos vemos', 'bye'],
                en: ['goodbye', 'bye', 'see you', 'later', 'take care'],
                pt: ['tchau', 'adeus', 'até logo', 'até mais', 'bye'],
            },
            help: {
                es: ['ayuda', 'qué puedes hacer', 'cómo funciona', 'opciones', 'comandos'],
                en: ['help', 'what can you do', 'how does this work', 'options', 'commands'],
                pt: ['ajuda', 'o que você pode fazer', 'como funciona', 'opções', 'comandos'],
            },
            faqQuery: {
                es: ['información sobre {topic}', 'cuál es el {topic}', 'dime sobre {topic}', 'qué hay de {topic}', 'pregunta sobre {topic}'],
                en: ['information about {topic}', 'what is the {topic}', 'tell me about {topic}', 'what about {topic}', 'question about {topic}'],
                pt: ['informação sobre {topic}', 'qual é o {topic}', 'me fale sobre {topic}', 'o que há sobre {topic}', 'pergunta sobre {topic}'],
            },
            feedback: {
                es: ['califico con {rating}', 'mi puntuación es {rating}', 'le doy {rating}', '{rating} estrellas'],
                en: ['I rate {rating}', 'my score is {rating}', 'I give it {rating}', '{rating} stars'],
                pt: ['eu avalio {rating}', 'minha pontuação é {rating}', 'eu dou {rating}', '{rating} estrelas'],
            },
        };

        return [
            // GreetingIntent
            {
                name: 'GreetingIntent',
                description: 'Handles user greetings',
                sampleUtterances: utterances.greeting[lang].map(u => ({ utterance: u })),
                fulfillmentCodeHook: { enabled: false },
                intentClosingSetting: {
                    closingResponse: {
                        messageGroupsList: [
                            {
                                message: {
                                    plainTextMessage: { value: messages.greeting[lang] },
                                },
                            },
                        ],
                    },
                },
            },
            // FarewellIntent
            {
                name: 'FarewellIntent',
                description: 'Handles user farewells',
                sampleUtterances: utterances.farewell[lang].map(u => ({ utterance: u })),
                fulfillmentCodeHook: { enabled: false },
                intentClosingSetting: {
                    closingResponse: {
                        messageGroupsList: [
                            {
                                message: {
                                    plainTextMessage: { value: messages.farewell[lang] },
                                },
                            },
                        ],
                    },
                },
            },
            // HelpIntent
            {
                name: 'HelpIntent',
                description: 'Provides help information',
                sampleUtterances: utterances.help[lang].map(u => ({ utterance: u })),
                fulfillmentCodeHook: { enabled: false },
                intentClosingSetting: {
                    closingResponse: {
                        messageGroupsList: [
                            {
                                message: {
                                    plainTextMessage: { value: messages.help[lang] },
                                },
                            },
                        ],
                    },
                },
            },
            // FAQQueryIntent
            {
                name: 'FAQQueryIntent',
                description: 'Handles FAQ queries with topic slot',
                sampleUtterances: utterances.faqQuery[lang].map(u => ({ utterance: u })),
                slots: [
                    {
                        name: 'topic',
                        slotTypeName: 'TopicType',
                        valueElicitationSetting: {
                            slotConstraint: 'Required',
                            promptSpecification: {
                                messageGroupsList: [
                                    {
                                        message: {
                                            plainTextMessage: { value: messages.faqPrompt[lang] },
                                        },
                                    },
                                ],
                                maxRetries: 2,
                            },
                        },
                    },
                ],
                fulfillmentCodeHook: { enabled: true },
            },
            // FeedbackIntent
            {
                name: 'FeedbackIntent',
                description: 'Collects user feedback with rating',
                sampleUtterances: utterances.feedback[lang].map(u => ({ utterance: u })),
                slots: [
                    {
                        name: 'rating',
                        slotTypeName: 'RatingType',
                        valueElicitationSetting: {
                            slotConstraint: 'Required',
                            promptSpecification: {
                                messageGroupsList: [
                                    {
                                        message: {
                                            plainTextMessage: { value: messages.feedbackPrompt[lang] },
                                        },
                                    },
                                ],
                                maxRetries: 2,
                            },
                        },
                    },
                ],
                fulfillmentCodeHook: { enabled: true },
                intentConfirmationSetting: {
                    promptSpecification: {
                        messageGroupsList: [
                            {
                                message: {
                                    plainTextMessage: { value: messages.feedbackThanks[lang] },
                                },
                            },
                        ],
                        maxRetries: 1,
                    },
                },
            },
            // FallbackIntent (required)
            {
                name: 'FallbackIntent',
                description: 'Handles unrecognized input',
                parentIntentSignature: 'AMAZON.FallbackIntent',
                fulfillmentCodeHook: { enabled: true },
                intentClosingSetting: {
                    closingResponse: {
                        messageGroupsList: [
                            {
                                message: {
                                    plainTextMessage: { value: messages.fallback[lang] },
                                },
                            },
                        ],
                    },
                },
            },
        ];
    }
}
