#!/bin/bash
# Script de despliegue para Chatbot AWS (Linux/Mac)
# Ejecutar: ./scripts/deploy.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================"
echo "  Chatbot AWS - Script de Despliegue"
echo "============================================"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Verificar prerrequisitos
echo -e "${YELLOW}[1/7] Verificando prerrequisitos...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js no está instalado${NC}"
    echo "Instalar desde: https://nodejs.org/"
    exit 1
fi
echo -e "  ${GREEN}✓ Node.js: $(node --version)${NC}"

# Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}ERROR: Python3 no está instalado${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Python: $(python3 --version)${NC}"

# AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}ERROR: AWS CLI no está instalado${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ AWS CLI: instalado${NC}"

# Verificar credenciales AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}ERROR: Credenciales AWS no configuradas${NC}"
    echo "Ejecutar: aws configure"
    exit 1
fi
echo -e "  ${GREEN}✓ AWS Credentials: configuradas${NC}"
echo ""

# Instalar dependencias del proyecto principal
echo -e "${YELLOW}[2/7] Instalando dependencias CDK...${NC}"
npm install
echo -e "  ${GREEN}✓ Dependencias CDK instaladas${NC}"
echo ""

# Instalar dependencias Python
echo -e "${YELLOW}[3/7] Instalando dependencias Python...${NC}"
pip3 install -r backend/requirements.txt
echo -e "  ${GREEN}✓ Dependencias Python instaladas${NC}"
echo ""

# Construir Lambda Layer
echo -e "${YELLOW}[4/7] Construyendo Lambda Layer...${NC}"
mkdir -p backend/layers/shared/python
pip3 install -r backend/layers/shared/requirements.txt -t backend/layers/shared/python --quiet
cp -r backend/src/shared backend/layers/shared/python/
echo -e "  ${GREEN}✓ Lambda Layer construido${NC}"
echo ""

# Construir Frontend
echo -e "${YELLOW}[5/7] Construyendo Frontend...${NC}"
cd frontend
npm install
npm run build
cd ..
echo -e "  ${GREEN}✓ Frontend construido${NC}"
echo ""

# CDK Bootstrap
echo -e "${YELLOW}[6/7] Ejecutando CDK Bootstrap...${NC}"
npx cdk bootstrap 2>/dev/null || true
echo -e "  ${GREEN}✓ CDK Bootstrap completado${NC}"
echo ""

# Desplegar con CDK
echo -e "${YELLOW}[7/7] Desplegando infraestructura con CDK...${NC}"
npx cdk deploy --all --require-approval never

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}  ✓ DESPLIEGUE EXITOSO${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${CYAN}Próximos pasos:${NC}"
    echo "  1. Actualizar VITE_WEBSOCKET_URL en frontend"
    echo "  2. Reconstruir frontend: cd frontend && npm run build"
    echo "  3. Poblar base de datos: python3 scripts/seed-database.py"
else
    echo ""
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}  ✗ ERROR EN EL DESPLIEGUE${NC}"
    echo -e "${RED}============================================${NC}"
    exit 1
fi
