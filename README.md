# 🤖 Chatbot Inteligente con NLP y Machine Learning

Chatbot conversacional construido con servicios de AWS para responder preguntas de usuarios, con análisis de sentimiento y soporte multi-idioma.

## 🏗️ Arquitectura

```
Frontend (S3+CloudFront) → API Gateway WebSocket
                              ↓
                    Lambda (Orquestador)
                              ↓
                    Amazon Lex (Intents/Slots)
                              ↓
                    Lambda (Fulfillment) → DynamoDB (Knowledge Base)
                              ↓
                    Comprehend (Sentiment Analysis)
                              ↓
                    Translate (Multi-idioma)
```

## 🛠️ Servicios AWS Utilizados

| Servicio | Función |
|----------|---------|
| **Amazon Lex v2** | Motor de conversación (NLU) |
| **AWS Lambda** | Lógica de negocio |
| **Amazon Comprehend** | Análisis de sentimiento |
| **Amazon Translate** | Traducción automática |
| **Amazon DynamoDB** | Base de conocimiento |
| **API Gateway** | API WebSocket |
| **Amazon S3 + CloudFront** | Frontend hospedado |

## 📋 Características

- ✅ Bot Lex con 6 intents definidos
- ✅ Slots con validación customizada
- ✅ Lambda fulfillment con integración a knowledge base
- ✅ Análisis de sentimiento en cada interacción
- ✅ Soporte multi-idioma (Español, Inglés, Portugués)
- ✅ Interfaz web responsiva con chat widget
- ✅ Contexto conversacional (memoria de sesión)
- ✅ Fallback intent con respuestas inteligentes
- ✅ Logs de conversaciones con analytics

## 🚀 Despliegue Rápido

### Prerrequisitos

1. **Node.js** >= 18.x
2. **Python** >= 3.9
3. **AWS CLI** configurado con credenciales
4. **AWS CDK** instalado globalmente

```bash
npm install -g aws-cdk
```

### Comandos de Despliegue

```powershell
# Despliegue completo (Windows)
.\scripts\deploy.ps1

# O paso a paso:
npm install                              # Instalar dependencias CDK
pip install -r backend/requirements.txt # Instalar dependencias Python
cd frontend && npm install && npm run build && cd ..  # Build frontend
cdk bootstrap                            # Solo primera vez
cdk deploy --all                         # Desplegar infraestructura
python scripts/seed-database.py          # Poblar datos iniciales
```

### Destruir Recursos

```powershell
.\scripts\destroy.ps1
# O manualmente:
cdk destroy --all
```

## 📁 Estructura del Proyecto

```
Chat_bot_AWS/
├── infrastructure/     # AWS CDK Stacks (TypeScript)
├── backend/           # Lambda Functions (Python)
├── frontend/          # React App (TypeScript)
├── lex/               # Definiciones de Lex Bot
├── data/              # FAQs y datos iniciales
├── scripts/           # Scripts de automatización
└── docs/              # Documentación
```

## 💰 Estimación de Costos

| Servicio | Costo Estimado |
|----------|----------------|
| Lex (1000 req) | $4.00 |
| Lambda | $1.00 |
| Comprehend | $0.50 |
| Translate | $1.50 |
| DynamoDB | $1.00 |
| S3+CloudFront | $1.00 |
| **Total** | **~$9.00/mes** |

## 📖 Documentación

- [Guía de Arquitectura](docs/architecture.md)
- [Referencia de API](docs/api-reference.md)
- [Guía de Despliegue](docs/deployment-guide.md)

## 🧪 Testing

```bash
# Tests de backend
cd backend && python -m pytest tests/

# Tests de infraestructura
npm run test

# Test del bot (requiere despliegue)
python scripts/test-bot.py
```

## 📝 Licencia

MIT License
