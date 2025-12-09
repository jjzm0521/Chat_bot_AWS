# Guía de Despliegue

Esta guía explica cómo desplegar el Chatbot Inteligente en AWS.

## Prerrequisitos

### Software Requerido

1. **Node.js** (v18 o superior)
   - Descargar: https://nodejs.org/

2. **Python** (v3.9 o superior)
   - Descargar: https://python.org/

3. **AWS CLI** (v2)
   - Descargar: https://aws.amazon.com/cli/
   - Configurar: `aws configure`

4. **AWS CDK** (global)
   ```bash
   npm install -g aws-cdk
   ```

### Configuración de AWS

#### Opción A: AWS Learner Lab

1. Inicia sesión en tu Learner Lab
2. Haz clic en "AWS Details"
3. Copia las credenciales de AWS CLI
4. En tu terminal, pega las credenciales en `~/.aws/credentials`

#### Opción B: Cuenta AWS Regular

1. Crea un usuario IAM con permisos de administrador
2. Genera Access Keys
3. Configura AWS CLI:
   ```bash
   aws configure
   # AWS Access Key ID: <tu-access-key>
   # AWS Secret Access Key: <tu-secret-key>
   # Default region: us-east-1
   # Default output format: json
   ```

## Despliegue Rápido

### Windows (PowerShell)

```powershell
# Navegar al proyecto
cd C:\Users\JOSSELYN\Documents\GitHub\Chat_bot_AWS

# Ejecutar script de despliegue
.\scripts\deploy.ps1
```

### Linux/Mac

```bash
# Dar permisos de ejecución
chmod +x scripts/deploy.sh

# Ejecutar
./scripts/deploy.sh
```

## Despliegue Paso a Paso

### 1. Instalar Dependencias

```bash
# Dependencias del proyecto CDK
npm install

# Dependencias Python
pip install -r backend/requirements.txt
```

### 2. Construir Lambda Layer

```bash
# Crear directorio del layer
mkdir -p backend/layers/shared/python

# Instalar dependencias en el layer
pip install -r backend/layers/shared/requirements.txt -t backend/layers/shared/python

# Copiar módulo shared
cp -r backend/src/shared backend/layers/shared/python/
```

### 3. Construir Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Bootstrap CDK (solo primera vez)

```bash
npx cdk bootstrap
```

### 5. Desplegar Infraestructura

```bash
# Ver cambios antes de desplegar
npx cdk diff

# Desplegar todo
npx cdk deploy --all

# O desplegar stack por stack en orden
npx cdk deploy ChatbotDatabaseStack
npx cdk deploy ChatbotStorageStack
npx cdk deploy ChatbotLambdaStack
npx cdk deploy ChatbotLexStack
npx cdk deploy ChatbotApiStack
npx cdk deploy ChatbotFrontendStack
```

### 6. Configurar Frontend

Después del despliegue, necesitas actualizar la URL del WebSocket:

1. Obtener el WebSocket endpoint:
   ```bash
   aws cloudformation describe-stacks --stack-name ChatbotApiStack \
     --query "Stacks[0].Outputs[?OutputKey=='WebSocketEndpoint'].OutputValue" \
     --output text
   ```

2. Crear archivo `.env` en `frontend/`:
   ```
   VITE_WEBSOCKET_URL=wss://xxxxx.execute-api.us-east-1.amazonaws.com/production
   ```

3. Reconstruir y subir frontend:
   ```bash
   cd frontend
   npm run build
   aws s3 sync dist/ s3://chatbot-frontend-<account-id>-<region>
   ```

### 7. Poblar Base de Datos

```bash
python scripts/seed-database.py
```

## Verificación

### Obtener URL del Frontend

```bash
aws cloudformation describe-stacks --stack-name ChatbotFrontendStack \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
  --output text
```

### Probar el Bot

1. Abre la URL de CloudFront en tu navegador
2. Haz clic en "Iniciar Conversación"
3. Prueba diferentes mensajes:
   - "Hola"
   - "¿Cuál es el precio?"
   - "Hello" (para probar multi-idioma)
   - "Ajuda" (portugués)

## Solución de Problemas

### Error: "Bootstrap required"

```bash
npx cdk bootstrap
```

### Error: "Insufficient permissions"

Verifica que tus credenciales AWS tengan permisos de administrador.

### Error: "Lex Bot not found"

El bot de Lex puede tardar unos minutos en estar listo. Espera 2-3 minutos y vuelve a intentar.

### WebSocket no conecta

1. Verifica que la URL del WebSocket sea correcta
2. Revisa los logs de Lambda en CloudWatch

## Destruir Recursos

Para eliminar todos los recursos y evitar costos:

```powershell
# Windows
.\scripts\destroy.ps1

# Linux/Mac
npx cdk destroy --all
```

## Costos Estimados

| Servicio | Uso | Costo Mensual |
|----------|-----|---------------|
| Amazon Lex | 1000 requests | ~$4.00 |
| Lambda | Invocaciones | ~$1.00 |
| Comprehend | Análisis | ~$0.50 |
| Translate | Traducciones | ~$1.50 |
| DynamoDB | Storage + I/O | ~$1.00 |
| S3 + CloudFront | Hosting | ~$1.00 |
| **Total** | | **~$9.00/mes** |

> **Nota**: En AWS Learner Lab estos costos se descuentan de tus créditos disponibles.
