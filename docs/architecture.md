# Arquitectura del Chatbot Inteligente

Este documento describe la arquitectura técnica del Chatbot Inteligente con NLP y Machine Learning.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUARIO                                         │
│                                │                                             │
│                                ▼                                             │
│                    ┌──────────────────────┐                                  │
│                    │   Chat Widget (React) │                                 │
│                    │   - Multi-idioma UI   │                                 │
│                    │   - WebSocket Client  │                                 │
│                    └──────────────────────┘                                  │
│                                │                                             │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │ WSS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AWS CLOUD                                           │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     FRONTEND LAYER                                     │ │
│  │  ┌─────────────────┐    ┌──────────────────────────────────────────┐  │ │
│  │  │   CloudFront    │◄───│              Amazon S3                    │  │ │
│  │  │  (CDN + HTTPS)  │    │         (Static Website)                  │  │ │
│  │  └─────────────────┘    └──────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        API LAYER                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │ │
│  │  │                  API Gateway (WebSocket)                          │  │ │
│  │  │  - $connect / $disconnect / sendMessage routes                   │  │ │
│  │  └──────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                 │                                           │
│                                 ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      COMPUTE LAYER                                     │ │
│  │                                                                        │ │
│  │  ┌────────────────────────┐     ┌────────────────────────────────┐    │ │
│  │  │  Lambda Orchestrator   │     │     Lambda Fulfillment          │    │ │
│  │  │  - WebSocket events    │     │     - Intent processing         │    │ │
│  │  │  - Language detection  │◄───►│     - FAQ queries               │    │ │
│  │  │  - Lex invocation      │     │     - Analytics logging         │    │ │
│  │  │  - Response routing    │     │     - Sentiment storage         │    │ │
│  │  └────────────────────────┘     └────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                 │                                           │
│                                 ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        NLP LAYER                                       │ │
│  │                                                                        │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐   │ │
│  │  │   Amazon Lex   │  │   Comprehend   │  │    Amazon Translate    │   │ │
│  │  │   (Bot NLU)    │  │  (Sentiment)   │  │   (Multi-language)     │   │ │
│  │  │                │  │                │  │                        │   │ │
│  │  │  6 Intents:    │  │  - Positive    │  │  Supported:            │   │ │
│  │  │  - Greeting    │  │  - Negative    │  │  - Spanish (es)        │   │ │
│  │  │  - Farewell    │  │  - Neutral     │  │  - English (en)        │   │ │
│  │  │  - FAQQuery    │  │  - Mixed       │  │  - Portuguese (pt)     │   │ │
│  │  │  - Help        │  │                │  │                        │   │ │
│  │  │  - Feedback    │  │  + Language    │  │                        │   │ │
│  │  │  - Fallback    │  │    Detection   │  │                        │   │ │
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                 │                                           │
│                                 ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        DATA LAYER                                      │ │
│  │                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │                      Amazon DynamoDB                             │   │ │
│  │  │                                                                  │   │ │
│  │  │  ┌─────────────────┐ ┌─────────────────┐ ┌────────────────────┐ │   │ │
│  │  │  │ Conversations   │ │ KnowledgeBase   │ │     Analytics      │ │   │ │
│  │  │  │ Table           │ │ Table           │ │     Table          │ │   │ │
│  │  │  │                 │ │                 │ │                    │ │   │ │
│  │  │  │ - Session ID    │ │ - FAQs (3 lang) │ │ - Metrics          │ │   │ │
│  │  │  │ - Messages      │ │ - Keywords      │ │ - Sentiment logs   │ │   │ │
│  │  │  │ - Sentiment     │ │ - Categories    │ │ - Intent usage     │ │   │ │
│  │  │  │ - TTL (7 days)  │ │                 │ │ - TTL (30 days)    │ │   │ │
│  │  │  └─────────────────┘ └─────────────────┘ └────────────────────┘ │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### 1. Envío de Mensaje

1. Usuario escribe mensaje en el chat widget
2. Frontend envía mensaje via WebSocket
3. API Gateway recibe y enruta a Lambda Orchestrator
4. Orchestrator detecta idioma con Comprehend
5. Si no es español, traduce con Translate
6. Envía a Lex para procesamiento NLU
7. Lex identifica intent y slots
8. Lambda Fulfillment consulta DynamoDB si es necesario
9. Respuesta traducida al idioma original
10. Análisis de sentimiento del mensaje
11. Respuesta enviada via WebSocket
12. Frontend muestra mensaje con indicador de sentimiento

### 2. Intents de Lex

| Intent | Descripción | Fulfillment |
|--------|-------------|-------------|
| GreetingIntent | Saludos | Lex (respuesta directa) |
| FarewellIntent | Despedidas | Lex (respuesta directa) |
| HelpIntent | Ayuda | Lex (respuesta directa) |
| FAQQueryIntent | Consultas FAQ | Lambda (consulta DynamoDB) |
| FeedbackIntent | Retroalimentación | Lambda (guarda analytics) |
| FallbackIntent | No entendido | Lambda (búsqueda inteligente) |

## Seguridad

- **IAM Roles**: Principio de mínimo privilegio
- **HTTPS**: Todo el tráfico encriptado
- **CloudFront**: CDN con protección DDoS
- **API Gateway**: Throttling y cuotas
- **DynamoDB**: Encriptación en reposo
