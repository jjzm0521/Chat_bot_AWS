# 📖 Guía de Configuración Manual para AWS Console

> **Nota:** Este proyecto utiliza AWS CDK para despliegue automatizado. Esta guía es solo como referencia para entender qué se configura o para configuración manual si es necesario.

---

## 🎯 Opción 1: Despliegue Automatizado (Recomendado)

```powershell
# 1. Configurar credenciales AWS
$env:AWS_ACCESS_KEY_ID = "tu-access-key"
$env:AWS_SECRET_ACCESS_KEY = "tu-secret-key"
$env:AWS_DEFAULT_REGION = "us-east-1"

# 2. Ejecutar script de despliegue
.\scripts\deploy.ps1
```

El CDK creará automáticamente:
- ✅ Bot Lex v2 con todos los intents
- ✅ Tablas DynamoDB
- ✅ Funciones Lambda
- ✅ API Gateway WebSocket
- ✅ S3 + CloudFront para frontend

---

## 🔧 Opción 2: Configuración Manual en AWS Console

### Paso 1: Crear Bot en Amazon Lex v2

1. Ir a **Amazon Lex** → **Bots** → **Create Bot**
2. Configurar:
   - **Bot name:** `ChatbotNLP`
   - **Runtime role:** Create a role with basic Amazon Lex permissions
   - **COPPA:** No
   - **Session timeout:** 5 minutos

---

### Paso 2: Configurar Locales (Idiomas)

Agregar 3 locales:

| Locale | ID | Voice |
|--------|-------|-------|
| Español | `es_ES` | Lucia |
| English | `en_US` | Joanna |
| Português | `pt_BR` | Camila |

---

### Paso 3: Crear Slot Types

#### SlotType: `RatingType`
```
Valores: 1, 2, 3, 4, 5
Resolution: Original Value
```

#### SlotType: `TopicType` (por idioma)

**Español:**
```
precio, envío, devolución, garantía, horario, ubicación, contacto
```

**English:**
```
price, shipping, return, warranty, hours, location, contact
```

**Português:**
```
preço, envio, devolução, garantia, horário, localização, contato
```

---

### Paso 4: Crear Intents

#### Intent 1: `GreetingIntent`

**Sample Utterances (ES):**
```
hola
buenos días
buenas tardes
buenas noches
qué tal
hey
```

**Sample Utterances (EN):**
```
hello
hi
good morning
good afternoon
good evening
hey
```

**Sample Utterances (PT):**
```
olá
oi
bom dia
boa tarde
boa noite
e aí
```

**Closing Response (ES):** 
```
¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte hoy?
```

**Closing Response (EN):**
```
Hello! I am your virtual assistant. How can I help you today?
```

**Closing Response (PT):**
```
Olá! Sou seu assistente virtual. Como posso ajudá-lo hoje?
```

**Fulfillment:** Disabled

---

#### Intent 2: `FarewellIntent`

**Sample Utterances (ES):**
```
adiós
hasta luego
chao
nos vemos
bye
```

**Sample Utterances (EN):**
```
goodbye
bye
see you
later
take care
```

**Sample Utterances (PT):**
```
tchau
adeus
até logo
até mais
bye
```

**Closing Response (ES):** 
```
¡Hasta luego! Fue un placer ayudarte.
```

**Fulfillment:** Disabled

---

#### Intent 3: `HelpIntent`

**Sample Utterances (ES):**
```
ayuda
qué puedes hacer
cómo funciona
opciones
comandos
```

**Sample Utterances (EN):**
```
help
what can you do
how does this work
options
commands
```

**Sample Utterances (PT):**
```
ajuda
o que você pode fazer
como funciona
opções
comandos
```

**Closing Response (ES):**
```
Puedo ayudarte con consultas sobre precios, envíos, devoluciones y más. ¿Qué necesitas saber?
```

**Fulfillment:** Disabled

---

#### Intent 4: `FAQQueryIntent`

**Sample Utterances (ES):**
```
información sobre {topic}
cuál es el {topic}
dime sobre {topic}
qué hay de {topic}
pregunta sobre {topic}
```

**Sample Utterances (EN):**
```
information about {topic}
what is the {topic}
tell me about {topic}
what about {topic}
question about {topic}
```

**Sample Utterances (PT):**
```
informação sobre {topic}
qual é o {topic}
me fale sobre {topic}
o que há sobre {topic}
pergunta sobre {topic}
```

**Slots:**
| Name | Type | Required | Prompt (ES) |
|------|------|----------|-------------|
| topic | TopicType | Yes | ¿Sobre qué tema te gustaría saber? |

**Fulfillment:** ✅ Enabled → Lambda ARN de fulfillment

---

#### Intent 5: `FeedbackIntent`

**Sample Utterances (ES):**
```
califico con {rating}
mi puntuación es {rating}
le doy {rating}
{rating} estrellas
```

**Sample Utterances (EN):**
```
I rate {rating}
my score is {rating}
I give it {rating}
{rating} stars
```

**Sample Utterances (PT):**
```
eu avalio {rating}
minha pontuação é {rating}
eu dou {rating}
{rating} estrelas
```

**Slots:**
| Name | Type | Required | Prompt (ES) |
|------|------|----------|-------------|
| rating | RatingType | Yes | ¿Cómo calificarías tu experiencia del 1 al 5? |

**Fulfillment:** ✅ Enabled → Lambda ARN de fulfillment

---

#### Intent 6: `FallbackIntent`

**Parent Intent:** `AMAZON.FallbackIntent`

**Closing Response (ES):**
```
Lo siento, no entendí tu pregunta. ¿Podrías reformularla?
```

**Fulfillment:** ✅ Enabled → Lambda ARN de fulfillment

---

### Paso 5: Crear Tablas DynamoDB

#### Tabla 1: `chatbot-conversations`
```
Primary Key (PK): String
Sort Key (SK): String
TTL Attribute: ttl
```

#### Tabla 2: `chatbot-knowledge-base`
```
Primary Key (PK): String
Sort Key (SK): String
```

#### Tabla 3: `chatbot-analytics`
```
Primary Key (PK): String
Sort Key (SK): String
TTL Attribute: ttl

GSI: DateIndex
  Partition Key: metricType
  Sort Key: date
```

---

### Paso 6: Crear Funciones Lambda

#### Lambda 1: `chatbot-orchestrator`
- **Runtime:** Python 3.11
- **Handler:** handler.lambda_handler
- **Memory:** 256 MB
- **Timeout:** 30 segundos
- **Environment Variables:**
  ```
  LEX_BOT_ID=<bot-id>
  LEX_BOT_ALIAS_ID=<alias-id>
  CONVERSATIONS_TABLE=chatbot-conversations
  KNOWLEDGE_BASE_TABLE=chatbot-knowledge-base
  ANALYTICS_TABLE=chatbot-analytics
  ```

#### Lambda 2: `chatbot-fulfillment`
- **Runtime:** Python 3.11
- **Handler:** handler.lambda_handler
- **Memory:** 256 MB
- **Timeout:** 30 segundos
- **Environment Variables:** (mismas que orchestrator)

---

### Paso 7: Crear API Gateway WebSocket

1. Crear API WebSocket
2. Agregar rutas:
   - `$connect`
   - `$disconnect`
   - `$default`
   - `sendMessage`
3. Integrar con Lambda orchestrator
4. Desplegar stage: `production`

---

### Paso 8: Crear S3 Bucket + CloudFront

1. Crear bucket S3 para hosting estático
2. Subir contenido de `frontend/dist/`
3. Crear distribución CloudFront apuntando al bucket

---

### Paso 9: Cargar Knowledge Base

Ejecutar script para poblar DynamoDB:

```powershell
python scripts/seed-database.py
```

O cargar manualmente los items desde `data/knowledge_base/faqs.json`.

---

## 📋 Permisos IAM Requeridos

### Lambda Orchestrator
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "lex:RecognizeText",
        "comprehend:DetectSentiment",
        "comprehend:DetectDominantLanguage",
        "translate:TranslateText",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "execute-api:ManageConnections"
      ],
      "Resource": "*"
    }
  ]
}
```

### Lambda Fulfillment
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "bedrock:InvokeModel"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## ✅ Verificación Final

Después del despliegue, verificar:

1. **Bot Lex:** Probar en consola Lex con mensajes de prueba
2. **Lambda:** Revisar logs en CloudWatch
3. **DynamoDB:** Verificar que las tablas tengan datos
4. **Frontend:** Acceder via URL de CloudFront
5. **WebSocket:** Probar conexión desde frontend

---

## 🚨 Troubleshooting

| Problema | Solución |
|----------|----------|
| Bot no responde | Verificar que el bot esté built y el alias publicado |
| Lambda timeout | Aumentar timeout o verificar conexión a servicios |
| 403 en CloudFront | Verificar política del bucket S3 |
| WebSocket falla | Verificar permisos de execute-api |
