# 📚 Documentación Técnica Completa - Chatbot Inteligente AWS

> **Documento Educativo para Curso de Servidores**  
> Este documento explica en detalle cada servicio AWS utilizado, cómo funcionan, cómo se relacionan, y el flujo de datos completo del sistema.

---

## 📋 Índice

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Arquitectura de Capas](#2-arquitectura-de-capas)
3. [Servicios AWS Utilizados](#3-servicios-aws-utilizados)
   - [Amazon S3 + CloudFront (Frontend)](#31-amazon-s3--cloudfront-frontend)
   - [API Gateway WebSocket](#32-api-gateway-websocket)
   - [AWS Lambda (Compute)](#33-aws-lambda-compute)
   - [Amazon Lex v2 (NLU)](#34-amazon-lex-v2-nlu)
   - [Amazon Comprehend (NLP)](#35-amazon-comprehend-nlp)
   - [Amazon Translate](#36-amazon-translate)
   - [Amazon Bedrock (IA Generativa)](#37-amazon-bedrock-ia-generativa)
   - [Amazon DynamoDB (Base de Datos)](#38-amazon-dynamodb-base-de-datos)
4. [Flujo de Datos Completo](#4-flujo-de-datos-completo)
5. [Estructura del Código](#5-estructura-del-código)
6. [Infraestructura como Código (CDK)](#6-infraestructura-como-código-cdk)
7. [Seguridad y Permisos IAM](#7-seguridad-y-permisos-iam)
8. [Glosario de Términos](#8-glosario-de-términos)

---

## 1. Visión General del Sistema

Este proyecto implementa un **chatbot conversacional inteligente** que utiliza múltiples servicios de AWS para:

- ✅ **Procesar lenguaje natural** (NLU) con Amazon Lex
- ✅ **Analizar sentimientos** del usuario con Comprehend
- ✅ **Traducir mensajes** automáticamente con Translate
- ✅ **Generar respuestas con IA** usando Amazon Bedrock (DeepSeek R1)
- ✅ **Mantener memoria conversacional** con DynamoDB
- ✅ **Comunicación en tiempo real** vía WebSockets

### Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FLUJO DE MENSAJES                                   │
│                                                                                  │
│   Usuario ──► Frontend (S3+CloudFront) ──► API Gateway (WebSocket)              │
│                                                   │                              │
│                                                   ▼                              │
│                                        Lambda Orquestador                        │
│                                    ┌───────┬───────┬───────┐                     │
│                                    │       │       │       │                     │
│                                    ▼       ▼       ▼       ▼                     │
│                              Comprehend   Lex  Translate  Bedrock               │
│                              (Sentimiento)(Intent)(Idioma) (IA)                  │
│                                    │       │       │       │                     │
│                                    └───────┴───────┴───────┘                     │
│                                              │                                   │
│                                              ▼                                   │
│                                          DynamoDB                                │
│                                    (Historial + Analytics)                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitectura de Capas

El sistema está organizado en **4 capas principales**:

### 2.1 Capa de Presentación (Frontend Layer)
| Componente | Función |
|------------|---------|
| **Amazon S3** | Almacena los archivos estáticos (HTML, CSS, JS) |
| **CloudFront** | CDN que distribuye el contenido con baja latencia y HTTPS |

### 2.2 Capa de API (API Layer)
| Componente | Función |
|------------|---------|
| **API Gateway WebSocket** | Maneja conexiones bidireccionales en tiempo real |

### 2.3 Capa de Cómputo (Compute Layer)
| Componente | Función |
|------------|---------|
| **Lambda Orquestador** | Recibe mensajes y coordina todos los servicios |
| **Lambda Fulfillment** | Procesa intents específicos de Lex |

### 2.4 Capa de Datos (Data Layer)
| Componente | Función |
|------------|---------|
| **DynamoDB** | 3 tablas para conversaciones, FAQs y analytics |

---

## 3. Servicios AWS Utilizados

### 3.1 Amazon S3 + CloudFront (Frontend)

#### ¿Qué es Amazon S3?
**Amazon Simple Storage Service (S3)** es un servicio de almacenamiento de objetos que ofrece:
- Escalabilidad prácticamente ilimitada
- Durabilidad del 99.999999999% (11 nueves)
- Acceso vía HTTP/HTTPS

#### ¿Qué es CloudFront?
**Amazon CloudFront** es una **Content Delivery Network (CDN)** que:
- Distribuye contenido desde ubicaciones edge cercanas al usuario
- Reduce latencia significativamente
- Proporciona HTTPS automático
- Protege contra ataques DDoS

#### Cómo se usa en este proyecto:

```typescript
// Archivo: infrastructure/lib/stacks/frontend-stack.ts

// 1. Crear bucket S3 para archivos estáticos
const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
    bucketName: `chatbot-frontend-${cdk.Aws.ACCOUNT_ID}`,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,  // Seguridad
    encryption: s3.BucketEncryption.S3_MANAGED,          // Encriptación
});

// 2. Crear distribución CloudFront
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
    defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    defaultRootObject: 'index.html',
});
```

**Flujo:**
1. Usuario accede a `https://d1234abcd.cloudfront.net`
2. CloudFront busca en caché el archivo solicitado
3. Si no está en caché, lo obtiene de S3
4. Retorna el contenido al usuario con baja latencia

---

### 3.2 API Gateway WebSocket

#### ¿Qué es API Gateway?
**Amazon API Gateway** permite crear APIs REST y WebSocket. En este proyecto usamos **WebSocket API** para comunicación bidireccional en tiempo real.

#### Diferencia entre HTTP y WebSocket:
| HTTP REST | WebSocket |
|-----------|-----------|
| Request/Response único | Conexión persistente |
| Cliente siempre inicia | Servidor puede enviar mensajes |
| Mayor latencia | Latencia mínima |
| Stateless | Stateful (mantiene conexión) |

#### Rutas configuradas:

```typescript
// Archivo: infrastructure/lib/stacks/api-stack.ts

this.websocketApi = new apigatewayv2.WebSocketApi(this, 'ChatbotWebSocketApi', {
    // Ruta cuando un cliente se conecta
    connectRouteOptions: {
        integration: new WebSocketLambdaIntegration('Connect', orchestratorLambda),
    },
    // Ruta cuando un cliente se desconecta
    disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration('Disconnect', orchestratorLambda),
    },
    // Ruta por defecto para mensajes
    defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration('Default', orchestratorLambda),
    },
});

// Ruta personalizada para enviar mensajes
this.websocketApi.addRoute('sendMessage', {
    integration: new WebSocketLambdaIntegration('SendMessage', orchestratorLambda),
});
```

**Rutas WebSocket:**
| Ruta | Evento | Descripción |
|------|--------|-------------|
| `$connect` | Cliente se conecta | Establece conexión WebSocket |
| `$disconnect` | Cliente se desconecta | Limpia recursos |
| `$default` | Mensaje genérico | Procesa cualquier mensaje |
| `sendMessage` | Mensaje de chat | Procesa mensaje del usuario |

---

### 3.3 AWS Lambda (Compute)

#### ¿Qué es AWS Lambda?
**AWS Lambda** es un servicio de **cómputo serverless** que:
- Ejecuta código sin aprovisionar servidores
- Escala automáticamente
- Cobra solo por tiempo de ejecución
- Soporta Python, Node.js, Java, Go, etc.

#### Funciones Lambda en este proyecto:

##### Lambda Orquestador (`ChatbotOrchestrator`)
**Propósito:** Punto de entrada principal que coordina todos los servicios.

```python
# Archivo: backend/src/handlers/orchestrator/handler.py

def lambda_handler(event: dict, context) -> dict:
    """Maneja eventos WebSocket."""
    route_key = event.get('requestContext', {}).get('routeKey')
    connection_id = event.get('requestContext', {}).get('connectionId')
    
    if route_key == '$connect':
        return handle_connect(connection_id, event)
    elif route_key == '$disconnect':
        return handle_disconnect(connection_id, event)
    else:
        return handle_message(connection_id, event)
```

**Flujo del mensaje en el Orquestador:**

```python
def handle_message(connection_id: str, event: dict) -> dict:
    # 1. Parsear mensaje del usuario
    body = json.loads(event.get('body', '{}'))
    user_message = body.get('message', '')
    session_id = body.get('sessionId', str(uuid.uuid4()))
    
    # 2. Detectar idioma con Comprehend
    detected_language, _ = comprehend_client.detect_language(user_message)
    
    # 3. Analizar sentimiento con Comprehend
    sentiment = comprehend_client.detect_sentiment(user_message, detected_language)
    
    # 4. Traducir a español si es necesario (Lex procesa en español)
    if detected_language != 'es':
        message_for_lex = translate_client.translate_to_spanish(user_message)
    
    # 5. Enviar a Lex para clasificar intent
    lex_response = lex_client.recognize_text(session_id, message_for_lex)
    intent_name = lex_response['intent_name']
    
    # 6. Obtener historial de conversación de DynamoDB
    conversation_history = dynamo_client.get_conversation_history(session_id, limit=5)
    
    # 7. Generar respuesta con IA (Bedrock - DeepSeek)
    bot_response = bedrock_client.generate_response(user_message, context)
    
    # 8. Guardar conversación en DynamoDB
    dynamo_client.save_message(message)
    
    # 9. Enviar respuesta al cliente via WebSocket
    return send_response(connection_id, event, response_data)
```

##### Lambda Fulfillment (`ChatbotFulfillment`)
**Propósito:** Procesa intents específicos que requieren lógica adicional.

```python
# Archivo: backend/src/handlers/fulfillment/handler.py

def lambda_handler(event: dict, context) -> dict:
    intent_name = event['sessionState']['intent']['name']
    
    # Ruteo basado en intent
    if intent_name == 'FAQQueryIntent':
        return handle_faq_query(event, slots, language)
    elif intent_name == 'FeedbackIntent':
        return handle_feedback(event, slots, language)
    elif intent_name == 'FallbackIntent':
        return handle_fallback(event, input_transcript, language)
    else:
        return close_intent(event, 'Fulfilled')
```

#### Configuración Lambda en CDK:

```typescript
// Archivo: infrastructure/lib/stacks/lambda-stack.ts

this.orchestratorFunction = new lambda.Function(this, 'OrchestratorFunction', {
    functionName: 'ChatbotOrchestrator',
    runtime: lambda.Runtime.PYTHON_3_11,     // Versión Python
    handler: 'handler.lambda_handler',        // Función de entrada
    code: lambda.Code.fromAsset('backend/src/handlers/orchestrator'),
    timeout: cdk.Duration.seconds(30),        // Timeout máximo
    memorySize: 256,                          // RAM en MB
    layers: [sharedLayer],                    // Dependencias compartidas
    environment: {                            // Variables de entorno
        CONVERSATIONS_TABLE: props.conversationsTable.tableName,
        LEX_BOT_ID: 'X3ADVBRCTQ',
        LEX_BOT_ALIAS_ID: '9VQMVYGAGE',
    },
});
```

---

### 3.4 Amazon Lex v2 (NLU)

#### ¿Qué es Amazon Lex?
**Amazon Lex** es un servicio de **Natural Language Understanding (NLU)** que:
- Identifica la **intención** del usuario (intent)
- Extrae **parámetros** de la frase (slots)
- Es el mismo motor que usa Amazon Alexa

#### Conceptos clave:

| Término | Definición | Ejemplo |
|---------|------------|---------|
| **Intent** | Objetivo del usuario | "GreetingIntent" (saludar) |
| **Utterance** | Frase que activa un intent | "Hola", "Buenos días" |
| **Slot** | Parámetro extraído | topic="envíos" en "pregunta sobre envíos" |
| **Fulfillment** | Acción al cumplir intent | Consultar base de datos |

#### Intents definidos:

| Intent | Descripción | Utterances de ejemplo | Fulfillment |
|--------|-------------|----------------------|-------------|
| `GreetingIntent` | Usuario saluda | "Hola", "Buen día" | Respuesta de Lex |
| `FarewellIntent` | Usuario se despide | "Adiós", "Hasta luego" | Respuesta de Lex |
| `HelpIntent` | Pide ayuda | "Ayuda", "¿Qué puedes hacer?" | Respuesta de Lex |
| `FAQQueryIntent` | Consulta información | "Pregunta sobre {topic}" | Lambda Fulfillment |
| `FeedbackIntent` | Da retroalimentación | "Califico {rating}" | Lambda Fulfillment |
| `FallbackIntent` | No se entiende | Cualquier otra frase | Lambda Fulfillment + Bedrock |

#### Cómo se invoca Lex:

```python
# Archivo: backend/src/shared/lex_client.py

class LexClient:
    def __init__(self):
        self.client = boto3.client('lexv2-runtime', region_name=Config.AWS_REGION)
        self.bot_id = Config.LEX_BOT_ID
        self.bot_alias_id = Config.LEX_BOT_ALIAS_ID
    
    def recognize_text(self, session_id: str, text: str, locale_id: str = 'es_ES'):
        """Envía texto a Lex para reconocimiento."""
        response = self.client.recognize_text(
            botId=self.bot_id,
            botAliasId=self.bot_alias_id,
            localeId=locale_id,       # es_ES, en_US, pt_BR
            sessionId=session_id,      # ID único por conversación
            text=text,
        )
        
        return {
            'intent_name': response['sessionState']['intent']['name'],
            'intent_state': response['sessionState']['intent']['state'],
            'slots': response['sessionState']['intent']['slots'],
            'messages': response.get('messages', []),
        }
```

---

### 3.5 Amazon Comprehend (NLP)

#### ¿Qué es Amazon Comprehend?
**Amazon Comprehend** es un servicio de **Procesamiento de Lenguaje Natural (NLP)** que usa machine learning para:
- Detectar idioma del texto
- Analizar sentimiento (positivo, negativo, neutro)
- Extraer entidades (personas, lugares, fechas)
- Identificar frases clave

#### Funciones utilizadas:

##### 1. Detección de Idioma
```python
# Archivo: backend/src/shared/comprehend_client.py

def detect_language(self, text: str) -> Tuple[str, float]:
    """Detecta el idioma dominante del texto."""
    response = self.client.detect_dominant_language(Text=text)
    
    if response['Languages']:
        lang = response['Languages'][0]
        return lang['LanguageCode'], lang['Score']  # ej: ('es', 0.99)
    
    return 'es', 0.0  # Default español
```

##### 2. Análisis de Sentimiento
```python
def detect_sentiment(self, text: str, language_code: str = 'es') -> Dict:
    """Analiza el sentimiento del texto."""
    response = self.client.detect_sentiment(
        Text=text,
        LanguageCode=language_code,
    )
    
    return {
        'sentiment': response['Sentiment'],  # POSITIVE, NEGATIVE, NEUTRAL, MIXED
        'scores': {
            'positive': response['SentimentScore']['Positive'],   # 0.0 - 1.0
            'negative': response['SentimentScore']['Negative'],
            'neutral': response['SentimentScore']['Neutral'],
            'mixed': response['SentimentScore']['Mixed'],
        },
    }
```

**Ejemplo de respuesta:**
```json
{
    "sentiment": "POSITIVE",
    "scores": {
        "positive": 0.85,
        "negative": 0.02,
        "neutral": 0.10,
        "mixed": 0.03
    }
}
```

##### 3. Extracción de Entidades
```python
def detect_entities(self, text: str, language_code: str = 'es') -> list:
    """Detecta entidades en el texto."""
    response = self.client.detect_entities(
        Text=text,
        LanguageCode=language_code,
    )
    
    return [
        {
            'text': entity['Text'],
            'type': entity['Type'],  # PERSON, LOCATION, DATE, ORGANIZATION...
            'score': entity['Score'],
        }
        for entity in response['Entities']
    ]
```

---

### 3.6 Amazon Translate

#### ¿Qué es Amazon Translate?
**Amazon Translate** es un servicio de **traducción automática neuronal** que:
- Traduce texto entre 75+ idiomas
- Usa modelos de deep learning
- Es altamente preciso y natural

#### Uso en el proyecto:

El bot procesa mensajes en español internamente (Lex), pero soporta usuarios en inglés y portugués. Translate se usa para:
1. Traducir mensaje del usuario AL español (para Lex)
2. Traducir respuesta DEL español al idioma del usuario

```python
# Archivo: backend/src/shared/translate_client.py

class TranslateClient:
    def translate_text(self, text: str, source_language: str, target_language: str) -> str:
        """Traduce texto entre idiomas."""
        if source_language == target_language:
            return text  # No traducir si es el mismo idioma
        
        response = self.client.translate_text(
            Text=text,
            SourceLanguageCode=source_language,  # 'es', 'en', 'pt'
            TargetLanguageCode=target_language,
        )
        
        return response['TranslatedText']
    
    def translate_to_spanish(self, text: str, source_language: str) -> str:
        """Atajo para traducir a español."""
        return self.translate_text(text, source_language, 'es')
    
    def translate_from_spanish(self, text: str, target_language: str) -> str:
        """Atajo para traducir desde español."""
        return self.translate_text(text, 'es', target_language)
```

---

### 3.7 Amazon Bedrock (IA Generativa)

#### ¿Qué es Amazon Bedrock?
**Amazon Bedrock** es un servicio de **IA Generativa** que proporciona acceso a modelos fundacionales (Foundation Models) de:
- Anthropic (Claude)
- Meta (Llama)
- Amazon (Titan)
- Mistral AI
- DeepSeek

#### Modelo utilizado: DeepSeek R1

Este proyecto usa **DeepSeek R1**, un modelo de razonamiento que:
- Analiza el problema paso a paso
- Genera respuestas contextualmente relevantes
- Retorna tanto el razonamiento como la respuesta final

```python
# Archivo: backend/src/shared/bedrock_client.py

class BedrockClient:
    def __init__(self):
        self.client = boto3.client('bedrock-runtime', region_name=Config.AWS_REGION)
        self.model_id = 'us.deepseek.r1-v1:0'  # Perfil de inferencia cross-region
    
    def generate_response(self, prompt: str, context: Optional[str] = None) -> str:
        """Genera respuesta usando DeepSeek R1."""
        
        # Mensaje del sistema define el comportamiento del bot
        system_msg = """Eres un asistente virtual amable para una tienda en linea.
Responde de forma breve y directa (1-2 oraciones maximo).
Se util, empatico y profesional."""
        
        body = {
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.7  # 0.0 = determinista, 1.0 = más creativo
        }
        
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(body),
            contentType='application/json',
            accept='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        
        # DeepSeek R1 retorna reasoning_content y content
        completion = response_body['choices'][0]['message'].get('content', '')
        
        return completion
```

#### Proceso de formateo de contexto:

```python
def build_context(intent_name: str, sentiment: str, language: str, history: str = "") -> str:
    """Construye contexto para DeepSeek basado en intent, sentimiento e historial."""
    context_parts = []
    
    # 1. Historial de conversación (memoria)
    if history:
        context_parts.append(f"HISTORIAL DE CONVERSACION:\n{history}\n")
    
    # 2. Pistas basadas en el intent detectado
    intent_hints = {
        'GreetingIntent': 'El usuario te saluda. Responde amablemente.',
        'FarewellIntent': 'El usuario se despide. Despidete cordialmente.',
        'GetHelpIntent': 'El usuario pide ayuda. Explica brevemente tus capacidades.',
        'FallbackIntent': 'Intenta entender que necesita el usuario.',
    }
    if intent_name in intent_hints:
        context_parts.append(intent_hints[intent_name])
    
    # 3. Ajuste basado en sentimiento
    if sentiment == 'NEGATIVE':
        context_parts.append('El usuario parece frustrado. Muestra empatia.')
    elif sentiment == 'POSITIVE':
        context_parts.append('El usuario esta contento. Manten un tono positivo.')
    
    # 4. Idioma de respuesta
    lang_names = {'es': 'espanol', 'en': 'ingles', 'pt': 'portugues'}
    context_parts.append(f'Responde en {lang_names.get(language, "espanol")}.')
    
    return '\n'.join(context_parts)
```

---

### 3.8 Amazon DynamoDB (Base de Datos)

#### ¿Qué es DynamoDB?
**Amazon DynamoDB** es una base de datos **NoSQL** serverless que ofrece:
- Latencia de milisegundos en cualquier escala
- Capacidad automática según demanda
- Alta disponibilidad y durabilidad
- Modelo de datos flexible (clave-valor y documentos)

#### Tablas del proyecto:

##### 1. ChatbotConversations (Historial de Chat)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `PK` | String | Partition Key: `SESSION#{sessionId}` |
| `SK` | String | Sort Key: `MSG#{timestamp}` |
| `userMessage` | String | Mensaje del usuario |
| `botResponse` | String | Respuesta del bot |
| `sentiment` | String | POSITIVE, NEGATIVE, NEUTRAL |
| `language` | String | es, en, pt |
| `intentName` | String | Intent detectado por Lex |
| `TTL` | Number | Time-To-Live (expira en 7 días) |

##### 2. ChatbotKnowledgeBase (FAQs)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `PK` | String | `FAQ#{category}` |
| `SK` | String | `TOPIC#{topicId}` |
| `question_es` | String | Pregunta en español |
| `answer_es` | String | Respuesta en español |
| `question_en` | String | Pregunta en inglés |
| `answer_en` | String | Respuesta en inglés |
| `keywords` | List | Palabras clave para búsqueda |

##### 3. ChatbotAnalytics (Métricas)
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `PK` | String | `METRIC#{metricType}` |
| `SK` | String | `EVENT#{eventId}` |
| `metricType` | String | CONNECTION, MESSAGE, FEEDBACK |
| `date` | String | Fecha YYYY-MM-DD |
| `metadata` | Map | Datos adicionales |
| `TTL` | Number | Expira en 30 días |

#### Cliente DynamoDB:

```python
# Archivo: backend/src/shared/dynamo_client.py

class DynamoClient:
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb', region_name=Config.AWS_REGION)
        self.conversations_table = self.dynamodb.Table('ChatbotConversations')
        self.knowledge_base_table = self.dynamodb.Table('ChatbotKnowledgeBase')
        self.analytics_table = self.dynamodb.Table('ChatbotAnalytics')
    
    def save_message(self, message: Message) -> None:
        """Guarda un mensaje en la tabla de conversaciones."""
        self.conversations_table.put_item(Item=message.to_dynamo_item())
    
    def get_conversation_history(self, session_id: str, limit: int = 10) -> List[Message]:
        """Obtiene los últimos mensajes de una sesión."""
        response = self.conversations_table.query(
            KeyConditionExpression=Key('PK').eq(f'SESSION#{session_id}'),
            ScanIndexForward=False,  # Más recientes primero
            Limit=limit,
        )
        return [Message.from_dynamo_item(item) for item in response.get('Items', [])]
    
    def search_faqs_by_keyword(self, keyword: str) -> List[FAQItem]:
        """Busca FAQs que contengan una palabra clave."""
        response = self.knowledge_base_table.scan(
            FilterExpression='contains(keywords, :kw)',
            ExpressionAttributeValues={':kw': keyword.lower()},
        )
        return [FAQItem.from_dynamo_item(item) for item in response.get('Items', [])]
```

---

## 4. Flujo de Datos Completo

### Secuencia de un mensaje de usuario:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario envía mensaje                                                  │
│ ────────────────────────────────                                               │
│ Frontend (React) ──WebSocket──► API Gateway ──► Lambda Orquestador             │
│                                                                                │
│ Mensaje: { "action": "sendMessage", "message": "Hello!", "sessionId": "abc" }  │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 2: Detectar idioma                                                        │
│ ───────────────────────                                                        │
│ Lambda ──► Comprehend.detect_dominant_language("Hello!")                       │
│                                                                                │
│ Resultado: { language: "en", confidence: 0.99 }                                │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 3: Analizar sentimiento                                                   │
│ ────────────────────────────                                                   │
│ Lambda ──► Comprehend.detect_sentiment("Hello!", "en")                         │
│                                                                                │
│ Resultado: { sentiment: "POSITIVE", scores: { positive: 0.85, ... } }          │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 4: Traducir a español (para Lex)                                          │
│ ─────────────────────────────────────                                          │
│ Lambda ──► Translate.translate_text("Hello!", "en", "es")                      │
│                                                                                │
│ Resultado: "¡Hola!"                                                            │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 5: Clasificar intent con Lex                                              │
│ ─────────────────────────────────                                              │
│ Lambda ──► Lex.recognize_text(sessionId="abc", text="¡Hola!")                  │
│                                                                                │
│ Resultado: { intent_name: "GreetingIntent", state: "Fulfilled" }               │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 6: Obtener historial de conversación                                      │
│ ──────────────────────────────────────────                                     │
│ Lambda ──► DynamoDB.query(PK="SESSION#abc", limit=5)                           │
│                                                                                │
│ Resultado: [ { userMessage: "...", botResponse: "..." }, ... ]                 │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 7: Generar respuesta con IA                                               │
│ ────────────────────────────────                                               │
│ Lambda ──► Bedrock.invoke_model(                                               │
│     model: "deepseek.r1",                                                      │
│     prompt: "Hello!",                                                          │
│     context: "GreetingIntent, POSITIVE sentiment, respond in English"          │
│ )                                                                              │
│                                                                                │
│ Resultado: "Hello! Welcome to our store. How can I help you today?"            │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 8: Guardar conversación                                                   │
│ ────────────────────────────                                                   │
│ Lambda ──► DynamoDB.put_item(                                                  │
│     PK: "SESSION#abc",                                                         │
│     SK: "MSG#2024-12-09T...",                                                  │
│     userMessage: "Hello!",                                                     │
│     botResponse: "Hello! Welcome...",                                          │
│     sentiment: "POSITIVE",                                                     │
│     intentName: "GreetingIntent"                                               │
│ )                                                                              │
└────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PASO 9: Enviar respuesta al usuario                                            │
│ ───────────────────────────────────                                            │
│ Lambda ──► API Gateway.post_to_connection(connectionId, response)              │
│                                                                                │
│ Respuesta WebSocket: {                                                         │
│     type: "message",                                                           │
│     message: "Hello! Welcome to our store. How can I help you today?",         │
│     sentiment: "POSITIVE",                                                     │
│     intent: "GreetingIntent",                                                  │
│     language: "en"                                                             │
│ }                                                                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Estructura del Código

```
Chat_bot_AWS/
│
├── backend/                              # Código Python para Lambda
│   ├── requirements.txt                  # Dependencias Python
│   ├── layers/                           # Lambda Layers
│   │   └── shared/                       # Capa compartida entre Lambdas
│   └── src/
│       ├── handlers/                     # Funciones Lambda
│       │   ├── orchestrator/
│       │   │   └── handler.py            # Orquestador principal
│       │   └── fulfillment/
│       │       └── handler.py            # Fulfillment de Lex
│       └── shared/                       # Módulos compartidos
│           ├── bedrock_client.py         # Cliente Bedrock/DeepSeek
│           ├── comprehend_client.py      # Cliente Comprehend
│           ├── dynamo_client.py          # Cliente DynamoDB
│           ├── lex_client.py             # Cliente Lex v2
│           ├── translate_client.py       # Cliente Translate
│           ├── config.py                 # Configuración
│           └── models.py                 # Modelos de datos
│
├── frontend/                             # Aplicación React
│   ├── src/
│   │   ├── components/                   # Componentes React
│   │   ├── hooks/                        # Hooks personalizados
│   │   └── services/                     # Servicios (WebSocket)
│   └── dist/                             # Build de producción
│
├── infrastructure/                       # AWS CDK (TypeScript)
│   ├── bin/
│   │   └── app.ts                        # Punto de entrada CDK
│   └── lib/stacks/
│       ├── api-stack.ts                  # API Gateway WebSocket
│       ├── database-stack.ts             # Tablas DynamoDB
│       ├── frontend-stack.ts             # S3 + CloudFront
│       ├── lambda-stack.ts               # Funciones Lambda
│       ├── lex-stack.ts                  # Bot Lex v2
│       └── storage-stack.ts              # Buckets adicionales
│
├── scripts/                              # Scripts de automatización
│   ├── deploy.ps1                        # Script despliegue Windows
│   ├── deploy.sh                         # Script despliegue Linux/Mac
│   └── seed-database.py                  # Poblar datos iniciales
│
├── data/                                 # Datos iniciales
│   └── faqs.json                         # FAQs pre-cargadas
│
└── docs/                                 # Documentación
    ├── architecture.md                   # Arquitectura técnica
    └── DOCUMENTACION_SERVIDORES.md       # Este documento
```

---

## 6. Infraestructura como Código (CDK)

### ¿Qué es AWS CDK?
**AWS Cloud Development Kit (CDK)** es un framework que permite definir infraestructura cloud usando lenguajes de programación como TypeScript, Python, Java, etc.

### Ventajas de CDK:
- ✅ Código versionable y auditable
- ✅ Reutilización de patrones
- ✅ Tipado estático (previene errores)
- ✅ Pruebas unitarias de infraestructura
- ✅ Sintetiza a CloudFormation

### Stacks del proyecto:

```typescript
// Archivo: infrastructure/bin/app.ts

const app = new cdk.App();

// 1. Base de datos (sin dependencias)
const databaseStack = new DatabaseStack(app, 'ChatbotDatabaseStack');

// 2. Lambda (depende de Database)
const lambdaStack = new LambdaStack(app, 'ChatbotLambdaStack', {
    conversationsTable: databaseStack.conversationsTable,
    knowledgeBaseTable: databaseStack.knowledgeBaseTable,
    analyticsTable: databaseStack.analyticsTable,
});

// 3. API Gateway (depende de Lambda)
const apiStack = new ApiStack(app, 'ChatbotApiStack', {
    orchestratorLambda: lambdaStack.orchestratorFunction,
});

// 4. Lex Bot (depende de Lambda Fulfillment)
const lexStack = new LexStack(app, 'ChatbotLexStack', {
    fulfillmentFunction: lambdaStack.fulfillmentFunction,
});

// 5. Frontend (depende de API)
const frontendStack = new FrontendStack(app, 'ChatbotFrontendStack', {
    apiEndpoint: apiStack.websocketApiEndpoint,
});
```

### Orden de despliegue:
```
DatabaseStack  ──►  LambdaStack  ──►  ApiStack
                         │               │
                         ▼               ▼
                    LexStack       FrontendStack
```

---

## 7. Seguridad y Permisos IAM

### Principio de Mínimo Privilegio
Cada Lambda tiene solo los permisos necesarios para su función.

### Política NLP para Lambda:

```typescript
// Archivo: infrastructure/lib/stacks/lambda-stack.ts

const nlpPolicy = new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        // Comprehend
        'comprehend:DetectSentiment',
        'comprehend:DetectDominantLanguage',
        'comprehend:DetectEntities',
        'comprehend:DetectKeyPhrases',
        
        // Translate
        'translate:TranslateText',
        
        // Bedrock
        'bedrock:InvokeModel',
        
        // Lex
        'lex:RecognizeText',
        'lex:PutSession',
        'lex:GetSession',
        'lex:DeleteSession',
    ],
    resources: ['*'],  // Servicios NLP usan recursos generales
});

// Aplicar política a ambas Lambdas
this.orchestratorFunction.addToRolePolicy(nlpPolicy);
this.fulfillmentFunction.addToRolePolicy(nlpPolicy);
```

### Permisos DynamoDB (más restrictivos):

```typescript
// Solo lectura/escritura a tablas específicas
props.conversationsTable.grantReadWriteData(this.orchestratorFunction);
props.knowledgeBaseTable.grantReadData(this.orchestratorFunction);
props.analyticsTable.grantWriteData(this.orchestratorFunction);
```

---

## 8. Glosario de Términos

| Término | Definición |
|---------|------------|
| **API Gateway** | Servicio AWS para crear y gestionar APIs |
| **Bedrock** | Servicio de IA Generativa con modelos fundacionales |
| **CDK** | Cloud Development Kit - IaC con lenguajes de programación |
| **CDN** | Content Delivery Network - Distribución de contenido |
| **CloudFront** | CDN de AWS para distribución global |
| **Comprehend** | Servicio NLP de AWS para análisis de texto |
| **DynamoDB** | Base de datos NoSQL serverless de AWS |
| **Fulfillment** | Lógica que se ejecuta cuando Lex detecta un intent |
| **IAM** | Identity and Access Management - Gestión de permisos |
| **Intent** | Intención del usuario detectada por Lex |
| **Lambda** | Servicio de cómputo serverless |
| **Lex** | Motor de NLU/chatbot de AWS (como Alexa) |
| **NLP** | Natural Language Processing |
| **NLU** | Natural Language Understanding |
| **S3** | Simple Storage Service - Almacenamiento de objetos |
| **Serverless** | Arquitectura sin gestión de servidores |
| **Slot** | Parámetro extraído de una frase por Lex |
| **Translate** | Servicio de traducción automática de AWS |
| **TTL** | Time-To-Live - Expiración automática de datos |
| **Utterance** | Frase de ejemplo que activa un intent |
| **WebSocket** | Protocolo de comunicación bidireccional |

---

## 📚 Referencias Adicionales

- [Documentación AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon Lex Developer Guide](https://docs.aws.amazon.com/lex/)
- [Amazon Comprehend Documentation](https://docs.aws.amazon.com/comprehend/)
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/)
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/)

---

> **Última actualización:** Diciembre 2024  
> **Autor:** Documentación generada para curso de servidores
